const express = require('express');
const axios = require('axios');

const router = express.Router();

const DEFAULT_PROVIDER = (process.env.MOVIE_PROVIDER || 'kkphim').toLowerCase();
const FALLBACK_PROVIDER = (process.env.MOVIE_API_FALLBACK_PROVIDER || '').toLowerCase();
const KKPHIM_API_BASE = (process.env.KKPHIM_API_BASE || process.env.MOVIE_API_BASE || 'https://phimapi.com').replace(/\/+$/, '');
const KKPHIM_IMAGE_BASE = (process.env.KKPHIM_IMAGE_BASE || 'https://phimimg.com').replace(/\/+$/, '');
const OPHIM_API_BASE = (process.env.OPHIM_API_BASE || 'https://ophim1.com/v1/api').replace(/\/+$/, '');
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
  provider: DEFAULT_PROVIDER,
};

function pruneCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldestKeys = [...cache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, cache.size - MAX_CACHE_ENTRIES)
    .map(([key]) => key);

  oldestKeys.forEach(key => cache.delete(key));
}

function buildCacheKey(req, provider) {
  const params = new URLSearchParams(req.query);
  return `${provider}:${req.path}?${params.toString()}`;
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
    provider: DEFAULT_PROVIDER,
    fallbackProvider: FALLBACK_PROVIDER || null,
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

function cleanQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, value])
  );
}

function normalizeMovie(movie = {}) {
  if (!movie || typeof movie !== 'object') return movie;
  const originName = movie.origin_name || movie.original_name || '';
  return {
    ...movie,
    origin_name: originName,
    original_name: originName,
    current_episode: movie.current_episode || movie.episode_current || '',
    movie_type: movie.movie_type || movie.type || '',
  };
}

function getItems(payload) {
  const items =
    payload?.items ||
    payload?.data?.items ||
    payload?.data?.data ||
    payload?.data?.movies ||
    payload?.movies ||
    payload?.result?.items ||
    [];
  return Array.isArray(items) ? items : [];
}

function getPagination(payload) {
  return payload?.pagination ||
    payload?.paginate ||
    payload?.data?.params?.pagination ||
    payload?.data?.paginate ||
    null;
}

function normalizeListPayload(payload, provider) {
  const items = getItems(payload).map(normalizeMovie);
  const pagination = getPagination(payload);
  return {
    status: 'success',
    success: true,
    provider,
    msg: payload?.msg || 'OK',
    items,
    pagination,
    paginate: pagination ? {
      current_page: pagination.currentPage ?? pagination.current_page ?? 1,
      total_page: pagination.totalPages ?? pagination.total_page ?? 1,
      total_items: pagination.totalItems ?? pagination.total_items ?? 0,
      items_per_page: pagination.totalItemsPerPage ?? pagination.items_per_page ?? 0,
    } : null,
    data: {
      ...(payload?.data && typeof payload.data === 'object' ? payload.data : {}),
      items,
      params: {
        ...(payload?.data?.params || {}),
        pagination,
      },
    },
  };
}

function normalizeDetailPayload(payload, provider) {
  const rawMovie = payload?.movie || payload?.item || payload?.data?.item || null;
  if (!rawMovie) return normalizeListPayload(payload, provider);
  const episodes = payload?.episodes || rawMovie.episodes || [];
  const movie = normalizeMovie({ ...rawMovie, episodes });
  return {
    status: 'success',
    success: true,
    provider,
    msg: payload?.msg || 'OK',
    movie,
    item: movie,
    data: { item: movie },
    episodes,
  };
}

function normalizeTaxonomyPayload(payload, provider, key) {
  const items = Array.isArray(payload) ? payload : getItems(payload);
  return {
    status: 'success',
    success: true,
    provider,
    [key]: items,
    data: { items },
    items,
  };
}

function normalizePayload(payload, kind, provider) {
  if (kind === 'detail') return normalizeDetailPayload(payload, provider);
  if (kind === 'taxonomy-category') return normalizeTaxonomyPayload(payload, provider, 'categories');
  if (kind === 'taxonomy-country') return normalizeTaxonomyPayload(payload, provider, 'countries');
  return normalizeListPayload(payload, provider);
}

function resolveKkphimRequest(requestPath, query = {}) {
  const path = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  const clean = cleanQuery(query);

  if (path === '/popular' || path === '/films/phim-moi-cap-nhat' || path === '/danh-sach/phim-moi-cap-nhat') {
    return { upstreamPath: '/danh-sach/phim-moi-cap-nhat-v3', query: { page: clean.page || 1 }, kind: 'list' };
  }
  if (path === '/the-loai') return { upstreamPath: '/the-loai', query: {}, kind: 'taxonomy-category' };
  if (path === '/quoc-gia') return { upstreamPath: '/quoc-gia', query: {}, kind: 'taxonomy-country' };
  if (path.startsWith('/phim/')) return { upstreamPath: path, query: {}, kind: 'detail' };
  if (path.startsWith('/tmdb/')) return { upstreamPath: path, query: clean, kind: 'detail' };
  if (path.startsWith('/films/search')) return { upstreamPath: '/v1/api/tim-kiem', query: clean, kind: 'list' };
  if (path.startsWith('/films/the-loai/')) return { upstreamPath: path.replace('/films/the-loai/', '/v1/api/the-loai/'), query: clean, kind: 'list' };
  if (path.startsWith('/films/quoc-gia/')) return { upstreamPath: path.replace('/films/quoc-gia/', '/v1/api/quoc-gia/'), query: clean, kind: 'list' };
  if (path.startsWith('/films/nam-phat-hanh/')) return { upstreamPath: path.replace('/films/nam-phat-hanh/', '/v1/api/nam/'), query: clean, kind: 'list' };
  if (path.startsWith('/films/nam/')) return { upstreamPath: path.replace('/films/nam/', '/v1/api/nam/'), query: clean, kind: 'list' };
  if (path.startsWith('/films/danh-sach/')) return { upstreamPath: path.replace('/films/danh-sach/', '/v1/api/danh-sach/'), query: clean, kind: 'list' };
  if (path.startsWith('/films/')) return { upstreamPath: path.replace('/films/', '/v1/api/danh-sach/'), query: clean, kind: 'list' };
  if (path.startsWith('/danh-sach/')) return { upstreamPath: path.replace('/danh-sach/', '/v1/api/danh-sach/'), query: clean, kind: 'list' };

  return { upstreamPath: path, query: clean, kind: 'list' };
}

function resolveOphimRequest(requestPath, query = {}) {
  let upstreamPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  if (upstreamPath === '/popular') upstreamPath = '/danh-sach/phim-moi-cap-nhat';
  if (upstreamPath.startsWith('/films/search')) upstreamPath = upstreamPath.replace('/films/search', '/tim-kiem');
  else if (upstreamPath.startsWith('/films/the-loai')) upstreamPath = upstreamPath.replace('/films/the-loai', '/the-loai');
  else if (upstreamPath.startsWith('/films/quoc-gia')) upstreamPath = upstreamPath.replace('/films/quoc-gia', '/quoc-gia');
  else if (upstreamPath.startsWith('/films/nam-phat-hanh')) upstreamPath = upstreamPath.replace('/films/nam-phat-hanh', '/nam-phat-hanh');
  else if (upstreamPath.startsWith('/films/danh-sach')) upstreamPath = upstreamPath.replace('/films/danh-sach', '/danh-sach');
  else if (upstreamPath.startsWith('/films/')) upstreamPath = upstreamPath.replace('/films/', '/danh-sach/');
  return { upstreamPath, query: cleanQuery(query), kind: upstreamPath.startsWith('/phim/') ? 'detail' : 'list' };
}

function resolveRequest(provider, requestPath, query) {
  if (provider === 'ophim') return resolveOphimRequest(requestPath, query);
  return resolveKkphimRequest(requestPath, query);
}

function providerBase(provider) {
  return provider === 'ophim' ? OPHIM_API_BASE : KKPHIM_API_BASE;
}

function providerHeaders(provider) {
  if (provider === 'ophim') {
    return {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://ophim19.cc/',
      Origin: 'https://ophim19.cc',
    };
  }
  return {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'NhanChillTV/1.0 (+https://tv.nhanchill.lol)',
    Referer: 'https://kkphim1.com/',
  };
}

async function fetchProviderData(provider, requestPath, query = {}) {
  const resolved = resolveRequest(provider, requestPath, query);
  const upstream = await axios.get(`${providerBase(provider)}${resolved.upstreamPath}`, {
    params: resolved.query,
    timeout: Number(process.env.MOVIE_API_TIMEOUT_MS || 12000),
    headers: providerHeaders(provider),
    validateStatus: () => true,
  });
  const isJson = String(upstream.headers['content-type'] || '').includes('application/json') || typeof upstream.data === 'object';
  if (upstream.status < 200 || upstream.status >= 300 || !isJson) {
    const error = new Error(`Movie provider ${provider} returned HTTP ${upstream.status}`);
    error.status = upstream.status;
    error.payload = upstream.data;
    throw error;
  }
  return normalizePayload(upstream.data, resolved.kind, provider);
}

async function fetchMovieData(requestPath, query = {}) {
  try {
    return await fetchProviderData(DEFAULT_PROVIDER, requestPath, query);
  } catch (err) {
    if (FALLBACK_PROVIDER && FALLBACK_PROVIDER !== DEFAULT_PROVIDER) {
      console.warn(`[Movies] ${DEFAULT_PROVIDER} failed, trying ${FALLBACK_PROVIDER}:`, err.message);
      return fetchProviderData(FALLBACK_PROVIDER, requestPath, query);
    }
    throw err;
  }
}

function normalizeImageUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;
  const cleaned = input.replace(/^\/+/, '');
  if (cleaned.startsWith('uploads/movies/')) return `https://img.ophim.live/${cleaned}`;
  return `${KKPHIM_IMAGE_BASE}/${cleaned}`;
}

async function prewarmMovieCache() {
  const targets = [
    { key: '/popular', path: '/popular', query: {} },
    { key: '/films/phim-moi-cap-nhat?page=1', path: '/films/phim-moi-cap-nhat', query: { page: 1 } },
    { key: '/films/danh-sach/phim-bo?page=1', path: '/films/danh-sach/phim-bo', query: { page: 1, limit: 24, sort_field: 'modified.time', sort_type: 'desc' } },
    { key: '/films/danh-sach/phim-le?page=1', path: '/films/danh-sach/phim-le', query: { page: 1, limit: 24, sort_field: 'modified.time', sort_type: 'desc' } },
    { key: '/films/the-loai/hanh-dong?page=1', path: '/films/the-loai/hanh-dong', query: { page: 1, limit: 24 } },
    { key: '/films/quoc-gia/han-quoc?page=1', path: '/films/quoc-gia/han-quoc', query: { page: 1, limit: 24 } },
  ];

  const results = [];
  for (const target of targets) {
    try {
      const data = await fetchMovieData(target.path, target.query);
      const params = new URLSearchParams(target.query);
      setCacheEntry(`${DEFAULT_PROVIDER}:${target.path}?${params.toString()}`, 200, data);
      results.push({ key: target.key, ok: true, status: 200, provider: data.provider });
    } catch (err) {
      results.push({ key: target.key, ok: false, error: err.message });
    }
  }

  cacheStats.lastPrewarmAt = new Date().toISOString();
  cacheStats.lastPrewarmError = results.find(item => !item.ok)?.error || null;
  return { provider: DEFAULT_PROVIDER, warmed: results.filter(item => item.ok).length, total: results.length, results };
}

async function handleMovieRequest(req, res, requestPath) {
  const cacheKey = buildCacheKey(req, DEFAULT_PROVIDER);
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
      request = fetchMovieData(requestPath, req.query).finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, request);
    }

    const data = await request;
    setCacheEntry(cacheKey, 200, data);
    return res
      .status(200)
      .set('Content-Type', 'application/json; charset=utf-8')
      .set('X-Movie-Cache', 'miss')
      .json(data);
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
      status: 'error',
      provider: DEFAULT_PROVIDER,
      error: `Movie API failed: ${err.message}`,
    });
  }
}

router.get('/image', (req, res) => {
  const imageUrl = normalizeImageUrl(req.query.url);
  if (!imageUrl) return res.status(400).send('Missing image url');
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return res.redirect(302, `${KKPHIM_API_BASE}/image.php?url=${encodeURIComponent(imageUrl)}`);
});

router.get('/popular', (req, res) => handleMovieRequest(req, res, '/popular'));
router.get('/*', (req, res) => handleMovieRequest(req, res, `/${req.params[0] || ''}`));

router._cache = {
  getStatus: getCacheStatus,
  clear: clearMovieCache,
  prewarm: prewarmMovieCache,
};

router._internal = {
  getItems,
  getPagination,
  normalizeMovie,
  normalizeListPayload,
  normalizeDetailPayload,
  normalizeImageUrl,
  resolveKkphimRequest,
  resolveOphimRequest,
};

module.exports = router;
