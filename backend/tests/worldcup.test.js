const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const test = require('node:test');
const { translateCountry } = require('../services/worldcup/countryTranslations');
const { normalizeWorldCupData } = require('../services/worldcup/matchNormalizer');
const { getWorldCupStreams, isM3u8Url } = require('../services/worldcup/streamResolver');

function sampleRawWorldCup() {
  return {
    teams: [
      { id: 1, name_en: 'South Africa', flag: '/za.png' },
      { id: 2, name_en: 'South Korea', flag: '/kr.png' },
      { id: 3, name_en: 'Australia', flag: '/au.png' },
    ],
    stadiums: [
      { id: 1, name_en: 'Estadio Azteca', city_en: 'Mexico City', country_en: 'Mexico' },
    ],
    games: [
      {
        id: '2',
        type: 'group',
        group: 'A',
        stadium_id: 1,
        local_date: '6/11/2026 20:00',
        home_team_id: 1,
        away_team_id: 2,
        finished: 'FALSE',
        time_elapsed: 'not_started',
        home_score: null,
        away_score: null,
      },
    ],
    groups: [
      {
        name: 'A',
        teams: [
          { team_id: 1, mp: 1, pts: 0, gd: -1, gf: 0, ga: 1 },
          { team_id: 2, mp: 1, pts: 3, gd: 1, gf: 1, ga: 0 },
          { team_id: 3, mp: 0, pts: 0, gd: 0, gf: 0, ga: 0 },
        ],
      },
    ],
  };
}

test('standings sort by points before API order', () => {
  const normalized = normalizeWorldCupData(sampleRawWorldCup(), { getStreams: () => [] });
  const [first, second] = normalized.groups[0].teams;

  assert.equal(first.team_name_vi, 'Hàn Quốc');
  assert.equal(Number(first.pts), 3);
  assert.equal(second.team_name_vi, 'Úc');
});

test('country names are translated to Vietnamese', () => {
  assert.equal(translateCountry('South Korea'), 'Hàn Quốc');
  assert.equal(translateCountry('South Africa'), 'Nam Phi');
  assert.equal(translateCountry('Australia'), 'Úc');
});

test('match kickoff is converted to Vietnam GMT+7 day key', () => {
  const normalized = normalizeWorldCupData(sampleRawWorldCup(), { getStreams: () => [] });
  const match = normalized.games[0];

  assert.equal(normalized.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(match.vnDateKey, '2026-06-12');
  assert.match(match.kickoffAtVN, /12\/06\/2026/);
});

test('World Cup streams only expose M3U8 sources', () => {
  const db = {
    getWorldCupStreams: () => [
      { id: 'custom-ok', name: 'Custom OK', sourceType: 'custom', stream: 'https://example.com/live/index.m3u8' },
      { id: 'custom-bad', name: 'Custom Bad', sourceType: 'custom', stream: 'https://example.com/live.ts' },
    ],
  };
  const channels = {
    vtv3hd: { id: 'vtv3hd', name: 'VTV3', url: 'https://cdn.example.com/vtv3/index.m3u8' },
    vtv6hd: { id: 'vtv6hd', name: 'VTV6', url: 'https://cdn.example.com/vtv6/live.ts' },
    vtv9hd: { id: 'vtv9hd', name: 'VTV9', url: 'https://cdn.example.com/vtv9/index.m3u8' },
    vtv10hd: { id: 'vtv10hd', name: 'VTV10', url: 'https://cdn.example.com/vtv10/index.m3u8' },
  };
  const m3uManager = { getChannelById: id => channels[id] || null };
  const streams = getWorldCupStreams('2', { db, m3uManager });

  assert(streams.length >= 3);
  assert(streams.every(stream => isM3u8Url(stream.stream)));
  assert.equal(streams.some(stream => stream.id === 'vtv6hd'), false);
  assert.equal(streams.some(stream => stream.id === 'custom-bad'), false);
});

test('finished World Cup matches do not render a player', async () => {
  const helperPath = path.resolve(__dirname, '../../frontend-astro/src/lib/worldCupMatchView.js');
  const { shouldRenderWorldCupPlayer } = await import(pathToFileURL(helperPath));

  assert.equal(shouldRenderWorldCupPlayer({ isFinished: true }), false);
  assert.equal(shouldRenderWorldCupPlayer({ isFinished: false }), true);
});
