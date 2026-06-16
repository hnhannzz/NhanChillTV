const { translateCountry } = require('./countryTranslations');
const { sortStandings } = require('./standingsSorter');

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const STADIUM_TIME_ZONES = {
  1: 'America/Mexico_City',
  2: 'America/Mexico_City',
  3: 'America/Monterrey',
  4: 'America/Chicago',
  5: 'America/Chicago',
  6: 'America/Chicago',
  7: 'America/New_York',
  8: 'America/New_York',
  9: 'America/New_York',
  10: 'America/New_York',
  11: 'America/New_York',
  12: 'America/Toronto',
  13: 'America/Vancouver',
  14: 'America/Los_Angeles',
  15: 'America/Los_Angeles',
  16: 'America/Los_Angeles',
};

const STAGE_TRANSLATIONS = {
  group: 'Vòng bảng',
  round_32: 'Vòng 32 đội',
  r32: 'Vòng 32 đội',
  round_16: 'Vòng 16 đội',
  r16: 'Vòng 16 đội',
  quarter_final: 'Tứ kết',
  qf: 'Tứ kết',
  semi_final: 'Bán kết',
  sf: 'Bán kết',
  third_place: 'Tranh hạng ba',
  third: 'Tranh hạng ba',
  final: 'Chung kết',
};

function parseScore(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (!text || text === 'null' || text === 'undefined' || text === '-') return null;
  const number = Number.parseInt(text, 10);
  return Number.isFinite(number) ? number : null;
}

function parseLocalDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    month: Number(match[1]),
    day: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function zonedLocalTimeToUtc(parsed, timeZone) {
  if (!parsed) return null;
  const desiredUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, 0);
  let utc = desiredUtc;

  for (let i = 0; i < 2; i += 1) {
    const parts = getTimeZoneParts(new Date(utc), timeZone);
    const actualUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
    utc -= actualUtc - desiredUtc;
  }

  return new Date(utc);
}

function getDateKey(date, timeZone = VN_TIME_ZONE) {
  const parts = getTimeZoneParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function formatInTimeZone(date, timeZone = VN_TIME_ZONE) {
  if (!date) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalizeScorers(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'null') return [];
  return text
    .replace(/[{}"]/g, '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeTeam(team) {
  const nameEn = team.name_en || team.name || '';
  return {
    ...team,
    name_vi: translateCountry(nameEn),
    display_name: translateCountry(nameEn),
  };
}

function normalizeStadium(stadium) {
  return {
    ...stadium,
    country_vi: translateCountry(stadium.country_en),
    display_country: translateCountry(stadium.country_en),
    timeZone: STADIUM_TIME_ZONES[Number(stadium.id)] || 'America/New_York',
  };
}

function normalizeGame(game, teamMap, stadiumMap) {
  const stadium = stadiumMap[String(game.stadium_id)] || {};
  const sourceTimeZone = stadium.timeZone || STADIUM_TIME_ZONES[Number(game.stadium_id)] || 'America/New_York';
  const kickoffDate = zonedLocalTimeToUtc(parseLocalDate(game.local_date), sourceTimeZone);
  const homeTeam = teamMap[String(game.home_team_id)];
  const awayTeam = teamMap[String(game.away_team_id)];
  const homeName = translateCountry(homeTeam?.name_en || game.home_team_name_en || game.home_team_label || 'Chưa xác định');
  const awayName = translateCountry(awayTeam?.name_en || game.away_team_name_en || game.away_team_label || 'Chưa xác định');
  const rawElapsed = String(game.time_elapsed || '').trim().toLowerCase();
  const finished = String(game.finished || '').toUpperCase() === 'TRUE' || rawElapsed === 'finished';
  const notStarted = !finished && ['not_started', 'notstarted', 'not started', ''].includes(rawElapsed);
  const isLive = !finished && !notStarted;
  const homeScore = parseScore(game.home_score);
  const awayScore = parseScore(game.away_score);

  return {
    ...game,
    stage_vi: STAGE_TRANSLATIONS[game.type] || game.type || 'Vòng đấu',
    sourceTimeZone,
    kickoffAt: kickoffDate ? kickoffDate.toISOString() : null,
    kickoffAtVN: kickoffDate ? formatInTimeZone(kickoffDate, VN_TIME_ZONE) : null,
    vnDateKey: kickoffDate ? getDateKey(kickoffDate, VN_TIME_ZONE) : null,
    home_score_value: homeScore,
    away_score_value: awayScore,
    has_score: homeScore !== null && awayScore !== null,
    home_scorers_list: normalizeScorers(game.home_scorers),
    away_scorers_list: normalizeScorers(game.away_scorers),
    status: finished ? 'finished' : isLive ? 'live' : 'upcoming',
    isLive,
    isFinished: finished,
    isUpcoming: !finished && !isLive,
    home_team_name_vi: homeName,
    away_team_name_vi: awayName,
    home_team_display: homeName,
    away_team_display: awayName,
    home_team_flag: homeTeam?.flag || null,
    away_team_flag: awayTeam?.flag || null,
    stadium_name: stadium.name_en || null,
    stadium_city: stadium.city_en || null,
    stadium_country_vi: stadium.country_vi || translateCountry(stadium.country_en),
  };
}

function byKickoffAsc(a, b) {
  return new Date(a.kickoffAt || 0).getTime() - new Date(b.kickoffAt || 0).getTime();
}

function byKickoffDesc(a, b) {
  return new Date(b.kickoffAt || 0).getTime() - new Date(a.kickoffAt || 0).getTime();
}

function groupByDate(games) {
  return games.reduce((acc, game) => {
    const key = game.vnDateKey || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(game);
    return acc;
  }, {});
}

function getTodayKey(now = new Date()) {
  return getDateKey(now, VN_TIME_ZONE);
}

function normalizeWorldCupData(raw, options = {}) {
  const getStreams = typeof options.getStreams === 'function' ? options.getStreams : () => [];
  const getHighlight = typeof options.getHighlight === 'function' ? options.getHighlight : () => null;
  const teams = (raw.teams || []).map(normalizeTeam);
  const stadiums = (raw.stadiums || []).map(normalizeStadium);
  const teamMap = Object.fromEntries(teams.map(team => [String(team.id), team]));
  const stadiumMap = Object.fromEntries(stadiums.map(stadium => [String(stadium.id), stadium]));
  const games = (raw.games || [])
    .map(game => normalizeGame(game, teamMap, stadiumMap))
    .map(game => ({ ...game, streams: getStreams(game.id), highlight: getHighlight(game.id) }))
    .sort(byKickoffAsc);

  const todayKey = getTodayKey(options.now || new Date());
  const liveGames = games.filter(game => game.isLive).sort(byKickoffAsc);
  const todayGames = games.filter(game => game.vnDateKey === todayKey).sort(byKickoffAsc);
  const upcomingGames = games.filter(game => game.isUpcoming).sort(byKickoffAsc);
  const finishedGames = games.filter(game => game.isFinished).sort(byKickoffDesc);
  const groups = (raw.groups || []).map(group => ({
    ...group,
    teams: sortStandings((group.teams || []).map(row => ({
      ...row,
      team: teamMap[String(row.team_id)] || null,
      team_name_vi: teamMap[String(row.team_id)]?.name_vi || `Đội #${row.team_id}`,
    }))),
  }));

  return {
    success: true,
    timezone: VN_TIME_ZONE,
    todayDate: todayKey,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    teams,
    stadiums,
    groups,
    games,
    liveGames,
    todayGames,
    upcomingGames,
    finishedGames,
    scheduleByDate: groupByDate(upcomingGames),
    resultsByDate: groupByDate(finishedGames),
    nextGames: upcomingGames.slice(0, 8),
  };
}

module.exports = {
  VN_TIME_ZONE,
  STADIUM_TIME_ZONES,
  STAGE_TRANSLATIONS,
  parseScore,
  parseLocalDate,
  getTimeZoneParts,
  zonedLocalTimeToUtc,
  getDateKey,
  getTodayKey,
  formatInTimeZone,
  normalizeScorers,
  normalizeTeam,
  normalizeStadium,
  normalizeGame,
  normalizeWorldCupData,
  byKickoffAsc,
  byKickoffDesc,
  groupByDate,
};
