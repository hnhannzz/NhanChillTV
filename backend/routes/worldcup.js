const express = require('express');
const path = require('path');
const config = require('../config');
const Database = require('../db/database');
const m3uManager = require('../services/m3uManager');
const { createWorldCupCacheService } = require('../services/worldcup/cacheService');
const {
  normalizeWorldCupData,
  byKickoffAsc,
} = require('../services/worldcup/matchNormalizer');
const { getWorldCupStreams } = require('../services/worldcup/streamResolver');

const router = express.Router();
const db = new Database(config.dbPath);

const API_BASE = process.env.WORLDCUP_API_BASE || 'https://worldcup26.ir';
const CACHE_FILE = process.env.WORLDCUP_CACHE_FILE || path.join(config.projectRoot, 'nginx/temp/worldcup-cache.json');
const SEED_FILE = path.join(config.projectRoot, 'backend/data/worldcup-seed.json');

const RESOURCE_CONFIG = {
  teams: { url: '/get/teams', ttlMs: 24 * 60 * 60 * 1000 },
  stadiums: { url: '/get/stadiums', ttlMs: 24 * 60 * 60 * 1000 },
  groups: { url: '/get/groups', ttlMs: 60 * 1000 },
  games: { url: '/get/games', ttlMs: 25 * 1000 },
};

const cacheService = createWorldCupCacheService({
  apiBase: API_BASE,
  resourceConfig: RESOURCE_CONFIG,
  cacheFile: CACHE_FILE,
  seedFile: SEED_FILE,
  timeoutMs: Number(process.env.WORLDCUP_API_TIMEOUT_MS || 20000),
});

let refreshAllPromise = null;

function normalize(raw) {
  return normalizeWorldCupData(raw, {
    getStreams: matchId => getWorldCupStreams(matchId, { db, m3uManager }),
    getHighlight: matchId => db.getWorldCupHighlight(matchId),
  });
}

function setWorldCupCacheHeaders(res, maxAge = 15) {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=60`);
}

async function sendResource(req, res, resourceName) {
  try {
    const force = req.query.refresh === '1';
    const raw = await cacheService.getAllResources({ force });
    const normalized = normalize(raw);
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
    const normalized = normalize(await cacheService.getAllResources({ force: req.query.refresh === '1' }));
    setWorldCupCacheHeaders(res, 15);
    res.json(normalized);
  } catch (err) {
    console.error('[WorldCup] summary error:', err.message);
    res.status(502).json({ success: false, error: 'Không thể tải dữ liệu World Cup lúc này.' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const normalized = normalize(await cacheService.getAllResources({ force: req.query.refresh === '1' }));
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

router.get('/matches/:id', async (req, res) => {
  try {
    const normalized = normalize(await cacheService.getAllResources({ force: req.query.refresh === '1' }));
    const match = normalized.games.find(game => String(game.id) === String(req.params.id));
    if (!match) return res.status(404).json({ success: false, error: 'Không tìm thấy trận đấu World Cup.' });
    setWorldCupCacheHeaders(res, 10);
    return res.json({
      success: true,
      timezone: normalized.timezone,
      updatedAt: normalized.updatedAt,
      match,
    });
  } catch (err) {
    console.error('[WorldCup] match error:', err.message);
    return res.status(502).json({ success: false, error: 'Không thể tải chi tiết trận World Cup.' });
  }
});

router.get('/teams', (req, res) => sendResource(req, res, 'teams'));
router.get('/games', (req, res) => sendResource(req, res, 'games'));
router.get('/groups', (req, res) => sendResource(req, res, 'groups'));
router.get('/stadiums', (req, res) => sendResource(req, res, 'stadiums'));

router.post('/refresh', async (req, res) => {
  try {
    const normalized = normalize(await cacheService.getAllResources({ force: true }));
    res.json({ success: true, updatedAt: normalized.updatedAt });
  } catch (err) {
    console.error('[WorldCup] refresh error:', err.message);
    res.status(502).json({ success: false, error: 'Không thể đồng bộ dữ liệu World Cup.' });
  }
});

router._prewarm = () => {
  if (!refreshAllPromise) {
    refreshAllPromise = cacheService.getAllResources()
      .catch(err => console.warn('[WorldCup] Prewarm failed:', err.message))
      .finally(() => { refreshAllPromise = null; });
  }
  return refreshAllPromise;
};

module.exports = router;
