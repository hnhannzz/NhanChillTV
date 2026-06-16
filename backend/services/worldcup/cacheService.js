const axios = require('axios');
const fs = require('fs');
const path = require('path');

function unwrapResource(name, payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.[name] || payload?.data || [];
}

function createWorldCupCacheService({
  apiBase,
  resourceConfig,
  cacheFile,
  seedFile,
  timeoutMs = 20000,
  userAgent = 'NhanChillTV/1.4 WorldCupCache',
}) {
  const memoryCache = {};
  let diskCacheLoaded = false;

  function ensureDiskCacheLoaded() {
    if (diskCacheLoaded) return;
    diskCacheLoaded = true;
    try {
      if (fs.existsSync(seedFile)) {
        const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        for (const name of Object.keys(resourceConfig)) {
          if (seed[name]?.data) memoryCache[name] = seed[name];
        }
      }
      if (fs.existsSync(cacheFile)) {
        const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        Object.assign(memoryCache, parsed);
      }
    } catch (err) {
      console.warn('[WorldCup] Could not load disk cache:', err.message);
    }
  }

  function saveDiskCache() {
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      const tempPath = `${cacheFile}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(memoryCache));
      fs.renameSync(tempPath, cacheFile);
    } catch (err) {
      console.warn('[WorldCup] Could not save disk cache:', err.message);
    }
  }

  async function refreshResource(name) {
    const resource = resourceConfig[name];
    if (!resource) throw new Error(`Unknown World Cup resource: ${name}`);

    const response = await axios.get(`${apiBase}${resource.url}`, {
      timeout: timeoutMs,
      decompress: true,
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      validateStatus: status => status >= 200 && status < 300,
    });

    const data = unwrapResource(name, response.data);
    memoryCache[name] = {
      data,
      fetchedAt: Date.now(),
      source: apiBase,
    };
    saveDiskCache();
    return data;
  }

  async function getResource(name, options = {}) {
    ensureDiskCacheLoaded();
    const resource = resourceConfig[name];
    if (!resource) throw new Error(`Unknown World Cup resource: ${name}`);

    const cached = memoryCache[name];
    const age = cached ? Date.now() - cached.fetchedAt : Infinity;
    if (!options.force && cached?.data && age < resource.ttlMs) return cached.data;

    if (options.force) {
      try {
        return await refreshResource(name);
      } catch (err) {
        if (cached?.data) {
          console.warn(`[WorldCup] Forced refresh failed for ${name}, using cached data:`, err.message);
          return cached.data;
        }
        throw err;
      }
    }

    if (cached?.data) {
      refreshResource(name).catch(err => {
        console.warn(`[WorldCup] Background refresh failed for ${name}:`, err.message);
      });
      return cached.data;
    }

    try {
      return await refreshResource(name);
    } catch (err) {
      if (cached?.data) {
        console.warn(`[WorldCup] Refresh failed for ${name}, using cached data:`, err.message);
        return cached.data;
      }
      throw err;
    }
  }

  async function getAllResources(options = {}) {
    const [teams, games, groups, stadiums] = await Promise.all([
      getResource('teams', options),
      getResource('games', options),
      getResource('groups', options),
      getResource('stadiums', options),
    ]);
    const fallbackTimes = Object.values(memoryCache)
      .map(item => item?.fetchedAt || 0)
      .filter(Boolean);
    const updatedAtMs = memoryCache.games?.fetchedAt || Math.max(0, ...fallbackTimes);
    return {
      teams,
      games,
      groups,
      stadiums,
      updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
    };
  }

  return {
    getResource,
    getAllResources,
    refreshResource,
    ensureDiskCacheLoaded,
  };
}

module.exports = {
  createWorldCupCacheService,
  unwrapResource,
};
