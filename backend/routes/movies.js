const express = require('express');
const axios = require('axios');

const router = express.Router();

const NGUONC_API_BASE = 'https://phim.nguonc.com/api';
const CACHE_TTL_MS = Number(process.env.MOVIE_API_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE_ENTRIES = Number(process.env.MOVIE_API_MAX_CACHE_ENTRIES || 200);
const cache = new Map();
const inFlight = new Map();

function pruneCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldestKeys = [...cache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, cache.size - MAX_CACHE_ENTRIES)
    .map(([key]) => key);

  oldestKeys.forEach(key => cache.delete(key));
}

function buildCacheKey(req) {
  const params = new URLSearchParams(req.query);
  return `${req.path}?${params.toString()}`;
}

function fetchUpstream(upstreamPath, query) {
  return axios.get(`${NGUONC_API_BASE}${upstreamPath}`, {
    params: query,
    timeout: 12000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NhanChillTV/1.0'
    },
    validateStatus: () => true
  });
}

router.get('/*', async (req, res) => {
  const upstreamPath = `/${req.params[0] || ''}`;
  const cacheKey = buildCacheKey(req);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res
      .status(cached.status)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('X-Movie-Cache', 'hit')
      .json(cached.data);
  }

  try {
    let request = inFlight.get(cacheKey);
    if (!request) {
      request = fetchUpstream(upstreamPath, req.query).finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, request);
    }

    const upstream = await request;

    const isJson = String(upstream.headers['content-type'] || '').includes('application/json');
    if (upstream.status >= 200 && upstream.status < 300 && isJson) {
      cache.set(cacheKey, {
        timestamp: now,
        status: upstream.status,
        data: upstream.data
      });
      pruneCache();
    }

    if (upstream.status === 429 && cached) {
      return res
        .status(200)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('X-Movie-Cache', 'stale')
        .json(cached.data);
    }

    return res
      .status(upstream.status)
      .set('Content-Type', isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8')
      .set('X-Movie-Cache', 'miss')
      .send(isJson ? JSON.stringify(upstream.data) : String(upstream.data || 'Nguonc API error'));
  } catch (err) {
    if (cached) {
      return res
        .status(200)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('X-Movie-Cache', 'stale')
        .json(cached.data);
    }

    return res.status(502).json({
      success: false,
      error: `Nguonc proxy failed: ${err.message}`
    });
  }
});

module.exports = router;
