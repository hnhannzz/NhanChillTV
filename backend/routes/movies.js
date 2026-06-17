const express = require('express');
const axios = require('axios');

const router = express.Router();

const NGUONC_API_BASE = 'https://ophim1.com/v1/api';
const NGUONC_POPULAR_URL = 'https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat';
const CACHE_TTL_MS = Number(process.env.MOVIE_API_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE_ENTRIES = Number(process.env.MOVIE_API_MAX_CACHE_ENTRIES || 200);
const cache = new Map();
const inFlight = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  stale: 0,
  errors: 0,
  lastPrewarmAt: null,
  lastPrewarmError: null,
};

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

function setCacheEntry(cacheKey, status, data) {
  cache.set(cacheKey, { timestamp: Date.now(), status, data });
  pruneCache();
}

function getCacheStatus() {
  const now = Date.now();
  const entries = [...cache.entries()].map(([key, value]) => ({
    key,
    status: value.status,
    ageMs: now - value.timestamp,
    fresh: now - value.timestamp < CACHE_TTL_MS,
  }));
  return {
    ttlMs: CACHE_TTL_MS,
    maxEntries: MAX_CACHE_ENTRIES,
    entries: cache.size,
    stats: cacheStats,
    hotEntries: entries.sort((a, b) => a.ageMs - b.ageMs).slice(0, 20),
  };
}

function clearMovieCache() {
  cache.clear();
  inFlight.clear();
}

function fetchUpstream(upstreamPath, query) {
  return axios.get(`${NGUONC_API_BASE}${upstreamPath}`, {
    params: query,
    timeout: 12000,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': 'https://ophim19.cc/',
      'Origin': 'https://ophim19.cc'
    },
    validateStatus: () => true
  });
}

async function fetchPopularData() {
  const page = await axios.get(NGUONC_POPULAR_URL, {
    timeout: 12000,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': 'https://ophim19.cc/',
      'Origin': 'https://ophim19.cc'
    }
  });
  const items = page.data?.data?.items?.slice(0, 8) || [];
  return { status: 'success', data: { items } };
}

async function prewarmMovieCache() {
  const targets = [
    { key: '/popular', type: 'popular' },
    { key: '/films/phim-moi-cap-nhat?page=1', upstreamPath: '/danh-sach/phim-moi-cap-nhat', query: { page: 1 } },
    { key: '/films/danh-sach/phim-bo?page=1', upstreamPath: '/danh-sach/phim-bo', query: { page: 1 } },
    { key: '/films/danh-sach/phim-le?page=1', upstreamPath: '/danh-sach/phim-le', query: { page: 1 } },
    { key: '/films/the-loai/hanh-dong?page=1', upstreamPath: '/the-loai/hanh-dong', query: { page: 1 } },
    { key: '/films/quoc-gia/han-quoc?page=1', upstreamPath: '/quoc-gia/han-quoc', query: { page: 1 } },
  ];

  const results = [];
  for (const target of targets) {
    try {
      if (target.type === 'popular') {
        const data = await fetchPopularData();
        setCacheEntry(target.key, 200, data);
        results.push({ key: target.key, ok: true, status: 200 });
      } else {
        const upstream = await fetchUpstream(target.upstreamPath, target.query);
        const isJson = String(upstream.headers['content-type'] || '').includes('application/json');
        if (upstream.status >= 200 && upstream.status < 300 && isJson) {
          setCacheEntry(target.key, upstream.status, upstream.data);
          results.push({ key: target.key, ok: true, status: upstream.status });
        } else {
          results.push({ key: target.key, ok: false, status: upstream.status });
        }
      }
    } catch (err) {
      results.push({ key: target.key, ok: false, error: err.message });
    }
  }

  cacheStats.lastPrewarmAt = new Date().toISOString();
  cacheStats.lastPrewarmError = results.find(item => !item.ok)?.error || null;
  return { warmed: results.filter(item => item.ok).length, total: results.length, results };
}

router.get('/popular', async (req, res) => {
  const cacheKey = '/popular';
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    cacheStats.hits += 1;
    return res.set('X-Movie-Cache', 'hit').json(cached.data);
  }

  try {
    cacheStats.misses += 1;
    const data = await fetchPopularData();
    setCacheEntry(cacheKey, 200, data);
    return res.set('X-Movie-Cache', 'miss').json(data);
  } catch (err) {
    cacheStats.errors += 1;
    if (cached) {
      cacheStats.stale += 1;
      return res.set('X-Movie-Cache', 'stale').json(cached.data);
    }
    return res.status(502).json({ success: false, error: `OPhim popular movies failed: ${err.message}` });
  }
});

router.get('/*', async (req, res) => {
  let upstreamPath = `/${req.params[0] || ''}`;

  if (upstreamPath.startsWith('/films/search')) {
    upstreamPath = upstreamPath.replace('/films/search', '/tim-kiem');
  } else if (upstreamPath.startsWith('/films/the-loai')) {
    upstreamPath = upstreamPath.replace('/films/the-loai', '/the-loai');
  } else if (upstreamPath.startsWith('/films/quoc-gia')) {
    upstreamPath = upstreamPath.replace('/films/quoc-gia', '/quoc-gia');
  } else if (upstreamPath.startsWith('/films/nam-phat-hanh')) {
    upstreamPath = upstreamPath.replace('/films/nam-phat-hanh', '/nam-phat-hanh');
  } else if (upstreamPath.startsWith('/films/danh-sach')) {
    upstreamPath = upstreamPath.replace('/films/danh-sach', '/danh-sach');
  } else if (upstreamPath.startsWith('/films/')) {
    upstreamPath = upstreamPath.replace('/films/', '/danh-sach/');
  }
  const cacheKey = buildCacheKey(req);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    cacheStats.hits += 1;
    return res
      .status(cached.status)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('X-Movie-Cache', 'hit')
      .json(cached.data);
  }

  try {
    cacheStats.misses += 1;
    let request = inFlight.get(cacheKey);
    if (!request) {
      request = fetchUpstream(upstreamPath, req.query).finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, request);
    }

    const upstream = await request;

    const isJson = String(upstream.headers['content-type'] || '').includes('application/json');
    if (upstream.status >= 200 && upstream.status < 300 && isJson) {
      setCacheEntry(cacheKey, upstream.status, upstream.data);
    }

    if (upstream.status === 429 && cached) {
      cacheStats.stale += 1;
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
    cacheStats.errors += 1;
    if (cached) {
      cacheStats.stale += 1;
      return res
        .status(200)
        .set('Content-Type', 'application/json; charset=utf-8')
        .set('X-Movie-Cache', 'stale')
        .json(cached.data);
    }

    return res.status(502).json({
      success: false,
      error: `OPhim proxy failed: ${err.message}`
    });
  }
});

router._cache = {
  getStatus: getCacheStatus,
  clear: clearMovieCache,
  prewarm: prewarmMovieCache,
};

module.exports = router;
