// World Cup 2026 Router - NhanChillTV Beta v1.3
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Database = require('../db/database');
const config = require('../config');
const adminRouter = require('./admin');
const m3uManager = require('../services/m3uManager');

const db = new Database(config.dbPath);
const adminSessions = adminRouter.adminSessions;

// In-memory cache
const cache = {
  games: { data: null, expiresAt: 0, duration: 2 * 60 * 1000 }, // 2 minutes
  groups: { data: null, expiresAt: 0, duration: 10 * 60 * 1000 }, // 10 minutes
  teams: { data: null, expiresAt: 0, duration: 10 * 60 * 1000 }, // 10 minutes
  stadiums: { data: null, expiresAt: 0, duration: 10 * 60 * 1000 } // 10 minutes
};

// Continuous background API sync (prevents RAM leaks by using simple object replacement)
let isUpdating = false;
async function updateGamesCache() {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const response = await axios.get('https://worldcup26.ir/get/games', { timeout: 10000 });
    if (response.data && response.data.games) {
      cache.games.data = response.data;
      cache.games.expiresAt = Date.now() + cache.games.duration;
    }
  } catch (err) {
    console.error('[WorldCup Background Update Error]', err.message);
  } finally {
    isUpdating = false;
  }
}

// Sync every 30 seconds
const bgInterval = setInterval(updateGamesCache, 30000);
if (bgInterval && bgInterval.unref) bgInterval.unref();

// Simple in-memory poll voting storage
// format: { [matchId]: { home: Number, draw: Number, away: Number, ips: Set } }
const pollVotes = {};

// Helper middleware for admin auth
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  const sessionToken = String(token || '').replace(/^Bearer\s+/i, '');
  if (adminSessions && adminSessions.has(sessionToken)) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// Helper function to fetch with cache
async function fetchCached(key, url) {
  const now = Date.now();
  const entry = cache[key];
  
  if (entry.data && now < entry.expiresAt) {
    return entry.data;
  }
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    if (response.data) {
      entry.data = response.data;
      entry.expiresAt = now + entry.duration;
      return response.data;
    }
  } catch (error) {
    console.error(`[WorldCup API Cache Error] Failed to fetch ${key} from ${url}:`, error.message);
    // Return stale data if available, otherwise fallback
    if (entry.data) {
      return entry.data;
    }
  }
  
  // Return fallback layout if API fails completely
  return { [key]: [] };
}

// PUBLIC ENDPOINTS

// GET /api/worldcup/games
router.get('/games', async (req, res) => {
  try {
    const apiData = await fetchCached('games', 'https://worldcup26.ir/get/games');
    const apiGames = apiData.games || [];
    
    // Merge database overrides
    const overrides = db.getWorldcupMatches();
    const mergedGames = apiGames.map(game => {
      const override = overrides.find(o => String(o.id) === String(game.id));
      
      // Construct streams list for each game
      const gameStreams = [];

      // 1. Admin custom stream override (if configured)
      if (override && override.sourceType) {
        gameStreams.push({
          id: 'admin_override',
          name: 'Luồng chính (Admin)',
          sourceType: override.sourceType,
          sourceChannelId: override.sourceChannelId,
          streamUrl: override.streamUrl === 'iptv' ? null : override.streamUrl
        });
      }

      // 2. Default VTV channels from loaded server sources (filter for HLS .m3u8 sources only)
      const vtv3 = m3uManager.getChannelById('vtv3hd');
      if (vtv3 && String(vtv3.url || '').toLowerCase().includes('.m3u8')) {
        gameStreams.push({
          id: 'vtv3',
          name: 'Bình luận Miền Bắc (VTV3)',
          sourceType: 'iptv',
          sourceChannelId: 'vtv3hd',
          streamUrl: null
        });
      }

      const vtv6 = m3uManager.getChannelById('vtv6hd');
      if (vtv6 && String(vtv6.url || '').toLowerCase().includes('.m3u8')) {
        gameStreams.push({
          id: 'vtv6',
          name: 'Bình luận Miền Bắc dự phòng (VTV6)',
          sourceType: 'iptv',
          sourceChannelId: 'vtv6hd',
          streamUrl: null
        });
      }

      const vtv9 = m3uManager.getChannelById('vtv9hd');
      if (vtv9 && String(vtv9.url || '').toLowerCase().includes('.m3u8')) {
        gameStreams.push({
          id: 'vtv9',
          name: 'Bình luận Nam Bộ (VTV9)',
          sourceType: 'iptv',
          sourceChannelId: 'vtv9hd',
          streamUrl: null
        });
      }

      const vtv10 = m3uManager.getChannelById('vtv10hd');
      if (vtv10 && String(vtv10.url || '').toLowerCase().includes('.m3u8')) {
        gameStreams.push({
          id: 'vtv10',
          name: 'Bình luận Nam Bộ dự phòng (VTV10)',
          sourceType: 'iptv',
          sourceChannelId: 'vtv10hd',
          streamUrl: null
        });
      }

      return {
        ...game,
        home_score: override && override.home_score !== undefined ? String(override.home_score) : game.home_score,
        away_score: override && override.away_score !== undefined ? String(override.away_score) : game.away_score,
        finished: override && override.finished !== undefined ? String(override.finished).toUpperCase() : game.finished,
        time_elapsed: override && override.time_elapsed !== undefined ? String(override.time_elapsed) : game.time_elapsed,
        local_date: override && override.local_date !== undefined ? String(override.local_date) : game.local_date,
        streamUrl: override ? (override.streamUrl || null) : null,
        sourceType: override ? (override.sourceType || null) : null,
        sourceChannelId: override ? (override.sourceChannelId || null) : null,
        streams: gameStreams
      };
    });
    
    res.json({ success: true, games: mergedGames });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/worldcup/groups
router.get('/groups', async (req, res) => {
  try {
    const data = await fetchCached('groups', 'https://worldcup26.ir/get/groups');
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/worldcup/teams
router.get('/teams', async (req, res) => {
  try {
    const data = await fetchCached('teams', 'https://worldcup26.ir/get/teams');
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/worldcup/stadiums
router.get('/stadiums', async (req, res) => {
  try {
    const data = await fetchCached('stadiums', 'https://worldcup26.ir/get/stadiums');
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/worldcup/poll/results
router.get('/poll/results', (req, res) => {
  const { matchId } = req.query;
  if (!matchId) {
    return res.status(400).json({ success: false, error: 'Match ID is required' });
  }
  
  if (!pollVotes[matchId]) {
    pollVotes[matchId] = { home: 0, draw: 0, away: 0, ips: [] };
  }
  
  const results = pollVotes[matchId];
  res.json({
    success: true,
    results: {
      home: results.home,
      draw: results.draw,
      away: results.away,
      total: results.home + results.draw + results.away
    }
  });
});

// POST /api/worldcup/poll/vote
router.post('/poll/vote', (req, res) => {
  const { matchId, option } = req.body;
  if (!matchId || !['home', 'draw', 'away'].includes(option)) {
    return res.status(400).json({ success: false, error: 'Invalid matchId or vote option' });
  }
  
  const clientIp = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  
  if (!pollVotes[matchId]) {
    pollVotes[matchId] = { home: 0, draw: 0, away: 0, ips: [] };
  }
  
  const matchPoll = pollVotes[matchId];
  if (matchPoll.ips.includes(clientIp)) {
    return res.status(400).json({ success: false, error: 'Bạn đã bình chọn cho trận đấu này rồi' });
  }
  
  matchPoll[option]++;
  matchPoll.ips.push(clientIp);
  
  res.json({
    success: true,
    results: {
      home: matchPoll.home,
      draw: matchPoll.draw,
      away: matchPoll.away,
      total: matchPoll.home + matchPoll.draw + matchPoll.away
    }
  });
});

// ADMIN OVERRIDE ENDPOINTS

// GET /api/worldcup/admin/games
router.get('/admin/games', auth, (req, res) => {
  try {
    const overrides = db.getWorldcupMatches();
    res.json({ success: true, data: overrides });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/worldcup/admin/games
router.post('/admin/games', auth, (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Match ID is required' });
    }
    const matchData = {
      id: String(id),
      home_score: req.body.home_score,
      away_score: req.body.away_score,
      finished: req.body.finished,
      time_elapsed: req.body.time_elapsed,
      local_date: req.body.local_date,
      streamUrl: req.body.streamUrl || null,
      sourceType: req.body.sourceType || null,
      sourceChannelId: req.body.sourceChannelId || null
    };
    
    db.saveWorldcupMatch(matchData);
    res.json({ success: true, data: matchData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/worldcup/admin/games/:id
router.delete('/admin/games/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Match ID is required' });
    }
    db.deleteWorldcupMatch(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
