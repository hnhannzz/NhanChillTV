const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();

const API_BASE = process.env.WORLDCUP_API_BASE || 'https://worldcup26.ir';
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const CACHE_FILE = process.env.WORLDCUP_CACHE_FILE || path.join(config.projectRoot, 'nginx/temp/worldcup-cache.json');

const RESOURCE_CONFIG = {
  teams: { url: '/get/teams', ttlMs: 24 * 60 * 60 * 1000 },
  stadiums: { url: '/get/stadiums', ttlMs: 24 * 60 * 60 * 1000 },
  groups: { url: '/get/groups', ttlMs: 60 * 1000 },
  games: { url: '/get/games', ttlMs: 25 * 1000 },
};

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

const COUNTRY_TRANSLATIONS = {
  Algeria: 'Algeria',
  Argentina: 'Argentina',
  Australia: 'Úc',
  Austria: 'Áo',
  Belgium: 'Bỉ',
  'Bosnia and Herzegovina': 'Bosnia và Herzegovina',
  Brazil: 'Brazil',
  Canada: 'Canada',
  'Cape Verde': 'Cabo Verde',
  Colombia: 'Colombia',
  'Congo DR': 'CHDC Congo',
  Croatia: 'Croatia',
  Curaçao: 'Curaçao',
  Curacao: 'Curaçao',
  'Czech Republic': 'Séc',
  Ecuador: 'Ecuador',
  Egypt: 'Ai Cập',
  England: 'Anh',
  France: 'Pháp',
  Germany: 'Đức',
  Ghana: 'Ghana',
  Haiti: 'Haiti',
  Iran: 'Iran',
  Iraq: 'Iraq',
  'Ivory Coast': 'Bờ Biển Ngà',
  Japan: 'Nhật Bản',
  Jordan: 'Jordan',
  Mexico: 'Mexico',
  Morocco: 'Ma Rốc',
  Netherlands: 'Hà Lan',
  'New Zealand': 'New Zealand',
  Norway: 'Na Uy',
  Panama: 'Panama',
  Paraguay: 'Paraguay',
  Portugal: 'Bồ Đào Nha',
  Qatar: 'Qatar',
  'Saudi Arabia': 'Ả Rập Xê Út',
  Scotland: 'Scotland',
  Senegal: 'Senegal',
  'South Africa': 'Nam Phi',
  'South Korea': 'Hàn Quốc',
  Spain: 'Tây Ban Nha',
  Sweden: 'Thụy Điển',
  Switzerland: 'Thụy Sĩ',
  Tunisia: 'Tunisia',
  Turkey: 'Thổ Nhĩ Kỳ',
  Turkiye: 'Thổ Nhĩ Kỳ',
  Türkiye: 'Thổ Nhĩ Kỳ',
  Uruguay: 'Uruguay',
  USA: 'Mỹ',
  'United States': 'Mỹ',
  Uzbekistan: 'Uzbekistan',
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

const memoryCache = {};
let diskCacheLoaded = false;
let refreshAllPromise = null;

function ensureDiskCacheLoaded() {
  if (diskCacheLoaded) return;
  diskCacheLoaded = true;
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    Object.assign(memoryCache, parsed);
  } catch (err) {
    console.warn('[WorldCup] Could not load disk cache:', err.message);
  }
}

function saveDiskCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tempPath = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(memoryCache));
    fs.renameSync(tempPath, CACHE_FILE);
  } catch (err) {
    console.warn('[WorldCup] Could not save disk cache:', err.message);
  }
}

function unwrapResource(name, payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.[name] || payload?.data || [];
}

async function refreshResource(name) {
  const resource = RESOURCE_CONFIG[name];
  if (!resource) throw new Error(`Unknown World Cup resource: ${name}`);

  const response = await axios.get(`${API_BASE}${resource.url}`, {
    timeout: Number(process.env.WORLDCUP_API_TIMEOUT_MS || 20000),
    decompress: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NhanChillTV/1.4 WorldCupCache',
    },
    validateStatus: status => status >= 200 && status < 300,
  });

  const data = unwrapResource(name, response.data);
  memoryCache[name] = {
    data,
    fetchedAt: Date.now(),
    source: API_BASE,
  };
  saveDiskCache();
  return data;
}

async function getResource(name, options = {}) {
  ensureDiskCacheLoaded();
  const resource = RESOURCE_CONFIG[name];
  if (!resource) throw new Error(`Unknown World Cup resource: ${name}`);

  const cached = memoryCache[name];
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  if (!options.force && cached?.data && age < resource.ttlMs) return cached.data;

  if (!options.force && cached?.data) {
    refreshResource(name).catch(err => {
      console.warn(`[WorldCup] Background refresh failed for ${name}:`, err.message);
    });
    return cached.data;
  }

  return refreshResource(name);
}

async function getAllResources(options = {}) {
  const [teams, games, groups, stadiums] = await Promise.all([
    getResource('teams', options),
    getResource('games', options),
    getResource('groups', options),
    getResource('stadiums', options),
  ]);
  return { teams, games, groups, stadiums };
}

function translateCountry(name) {
  if (!name) return '';
  return COUNTRY_TRANSLATIONS[String(name).trim()] || String(name).trim();
}

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

function getTodayKey() {
  return getDateKey(new Date(), VN_TIME_ZONE);
}

function normalizeWorldCupData(raw) {
  const teams = (raw.teams || []).map(normalizeTeam);
  const stadiums = (raw.stadiums || []).map(normalizeStadium);
  const teamMap = Object.fromEntries(teams.map(team => [String(team.id), team]));
  const stadiumMap = Object.fromEntries(stadiums.map(stadium => [String(stadium.id), stadium]));
  const games = (raw.games || [])
    .map(game => normalizeGame(game, teamMap, stadiumMap))
    .sort(byKickoffAsc);

  const todayKey = getTodayKey();
  const liveGames = games.filter(game => game.isLive).sort(byKickoffAsc);
  const todayGames = games.filter(game => game.vnDateKey === todayKey).sort(byKickoffAsc);
  const upcomingGames = games
    .filter(game => game.isUpcoming)
    .sort(byKickoffAsc);
  const finishedGames = games
    .filter(game => game.isFinished)
    .sort(byKickoffDesc);
  const groups = (raw.groups || []).map(group => ({
    ...group,
    teams: (group.teams || []).map(row => ({
      ...row,
      team: teamMap[String(row.team_id)] || null,
      team_name_vi: teamMap[String(row.team_id)]?.name_vi || `Đội #${row.team_id}`,
    })),
  }));

  return {
    success: true,
    timezone: VN_TIME_ZONE,
    todayDate: todayKey,
    updatedAt: new Date().toISOString(),
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

function setWorldCupCacheHeaders(res, maxAge = 15) {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=60`);
}

async function sendResource(req, res, resourceName) {
  try {
    const force = req.query.refresh === '1';
    const raw = await getAllResources({ force });
    const normalized = normalizeWorldCupData(raw);
    const maxAge = resourceName === 'teams' || resourceName === 'stadiums' ? 3600 : 15;
    setWorldCupCacheHeaders(res, maxAge);
    return res.json({ success: true, [resourceName]: normalized[resourceName] });
  } catch (err) {
    console.error(`[WorldCup] ${resourceName} error:`, err.message);
    return res.status(502).json({ success: false, error: 'Không thể tải dữ liệu World Cup lúc này.' });
  }
}

router.get('/summary', async (req, res) => {
  try {
    const normalized = normalizeWorldCupData(await getAllResources({ force: req.query.refresh === '1' }));
    setWorldCupCacheHeaders(res, 15);
    res.json(normalized);
  } catch (err) {
    console.error('[WorldCup] summary error:', err.message);
    res.status(502).json({ success: false, error: 'Không thể tải dữ liệu World Cup lúc này.' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const normalized = normalizeWorldCupData(await getAllResources({ force: req.query.refresh === '1' }));
    const dateKey = req.query.date || normalized.todayDate;
    const matches = normalized.games.filter(game => game.vnDateKey === dateKey).sort(byKickoffAsc);
    setWorldCupCacheHeaders(res, 15);
    res.json({
      success: true,
      timezone: normalized.timezone,
      date: dateKey,
      updatedAt: normalized.updatedAt,
      matches,
      liveGames: normalized.liveGames,
      nextGames: normalized.nextGames,
    });
  } catch (err) {
    console.error('[WorldCup] today error:', err.message);
    res.status(502).json({ success: false, error: 'Không thể tải lịch World Cup hôm nay.' });
  }
});

router.get('/teams', (req, res) => sendResource(req, res, 'teams'));
router.get('/games', (req, res) => sendResource(req, res, 'games'));
router.get('/groups', (req, res) => sendResource(req, res, 'groups'));
router.get('/stadiums', (req, res) => sendResource(req, res, 'stadiums'));

router.post('/refresh', async (req, res) => {
  try {
    const normalized = normalizeWorldCupData(await getAllResources({ force: true }));
    res.json({ success: true, updatedAt: normalized.updatedAt });
  } catch (err) {
    console.error('[WorldCup] refresh error:', err.message);
    res.status(502).json({ success: false, error: 'Không thể đồng bộ dữ liệu World Cup.' });
  }
});

router._prewarm = () => {
  if (!refreshAllPromise) {
    refreshAllPromise = getAllResources()
      .catch(err => console.warn('[WorldCup] Prewarm failed:', err.message))
      .finally(() => { refreshAllPromise = null; });
  }
  return refreshAllPromise;
};

module.exports = router;
