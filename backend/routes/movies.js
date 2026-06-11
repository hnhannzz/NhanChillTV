const express = require('express');
const axios = require('axios');

const router = express.Router();

const NGUONC_API_BASE = 'https://phim.nguonc.com/api';
const NGUONC_POPULAR_URL = 'https://phim.nguonc.com/danh-sach-phim?cats%5B1%5D=163&cats%5B6%5D=&cats%5B25%5D=&cats%5B47%5D=&sort_field=view';
const CACHE_TTL_MS = Number(process.env.MOVIE_API_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE_ENTRIES = Number(process.env.MOVIE_API_MAX_CACHE_ENTRIES || 200);
const cache = new Map();
const inFlight = new Map();
const BLOCKED_EPISODE_FIELDS = new Set(['m3u8', 'link_m3u8', 'file']);

function sanitizeNguoncPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeNguoncPayload);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !BLOCKED_EPISODE_FIELDS.has(key.toLowerCase()))
    .map(([key, child]) => [key, sanitizeNguoncPayload(child)]));
}

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

router.get('/popular', async (req, res) => {
  const cacheKey = '/popular';
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.set('X-Movie-Cache', 'hit').json(cached.data);
  }

  try {
    const page = await axios.get(NGUONC_POPULAR_URL, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 NhanChillTV/1.0' }
    });
    const slugs = [];
    const seen = new Set();
    const pattern = /href=["'](?:https:\/\/phim\.nguonc\.com)?\/phim\/([^"'?#/]+)["']/gi;
    let match;

    while ((match = pattern.exec(String(page.data))) && slugs.length < 12) {
      const slug = decodeURIComponent(match[1]);
      if (!seen.has(slug)) {
        seen.add(slug);
        slugs.push(slug);
      }
    }

    const results = await Promise.allSettled(slugs.map(slug => fetchUpstream(`/film/${slug}`)));
    const items = results
      .filter(result => result.status === 'fulfilled' && result.value.status === 200 && result.value.data?.movie)
      .map(result => sanitizeNguoncPayload(result.value.data.movie))
      .slice(0, 8);

    if (!items.length) throw new Error('Popular movie page returned no usable films');

    const data = { status: 'success', items };
    cache.set(cacheKey, { timestamp: now, status: 200, data });
    pruneCache();
    return res.set('X-Movie-Cache', 'miss').json(data);
  } catch (err) {
    if (cached) return res.set('X-Movie-Cache', 'stale').json(cached.data);
    return res.status(502).json({ success: false, error: `Nguonc popular movies failed: ${err.message}` });
  }
});

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
      const sanitizedData = sanitizeNguoncPayload(upstream.data);
      cache.set(cacheKey, {
        timestamp: now,
        status: upstream.status,
        data: sanitizedData
      });
      pruneCache();
      upstream.data = sanitizedData;
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
