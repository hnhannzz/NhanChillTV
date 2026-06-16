const axios = require('axios');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');
const config = require('../config');

const DEFAULT_EPG_URL = 'https://raw.githubusercontent.com/hnhannzz/NhanChillTV/main/backend/data/epg.xml.gz';
const EPG_STALE_GRACE_MS = 2 * 60 * 60 * 1000;

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getAliasKeys(value) {
  const key = normalizeKey(value);
  if (!key) return [];

  const keys = new Set([key]);
  const withoutQuality = key.replace(/(?:fullhd|fhd|hd|sd)$/i, '');
  if (withoutQuality) keys.add(withoutQuality);

  const withoutChannel = withoutQuality.replace(/(?:channel|kenh)$/i, '');
  if (withoutChannel) keys.add(withoutChannel);
  return [...keys];
}

function getText(node) {
  if (!node) return '';
  if (Array.isArray(node)) return getText(node[0]);
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node['#text'] || '';
}

function getIcon(node) {
  if (!node) return '';
  const icon = Array.isArray(node) ? node[0] : node;
  return typeof icon === 'object' ? icon['@_src'] || '' : '';
}

function parseEpgTime(timeStr) {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return 0;

  const [, y, m, d, h, min, s, tz] = match;
  const offset = tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : '+07:00';
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}${offset}`).getTime();
}

class EpgService {
  constructor() {
    this.epgUrl = process.env.EPG_URL || DEFAULT_EPG_URL;
    const configuredFallbacks = String(process.env.EPG_FALLBACK_URLS || 'https://vnepg.site/epg.xml.gz,https://epg.pw/xmltv/epg_VN.xml')
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);
    this.sourceUrls = [...new Set([this.epgUrl, ...configuredFallbacks])];
    this.channels = {};
    this.programs = {};
    this.aliases = {};
    this.channelIds = {};
    this.lastFetch = null;
    this.lastError = null;
    this.fetchPromise = null;
    this.fetchInterval = Number(process.env.EPG_CACHE_TTL_MS || 60 * 60 * 1000);
    this.failureRetryInterval = Number(process.env.EPG_RETRY_MS || 5 * 60 * 1000);
    this.cachePath = config.epgCachePath;
    this.lastAttempt = 0;
    this.activeSource = null;

    this.loadDiskCache();
  }

  async ensureData() {
    if (this.lastFetch && Date.now() - this.lastFetch.getTime() < this.fetchInterval && Object.keys(this.programs).length > 0) {
      return;
    }
    if (this.lastError && Date.now() - this.lastAttempt < this.failureRetryInterval) return;
    await this.fetchData();
  }

  loadDiskCache() {
    try {
      if (!fs.existsSync(this.cachePath)) return;
      const xml = fs.readFileSync(this.cachePath, 'utf8').replace(/^\uFEFF/, '');
      this.parseEpg(xml);
      this.lastFetch = fs.statSync(this.cachePath).mtime;
      console.log(`[EPG] Loaded persistent cache from ${this.cachePath}`);
    } catch (err) {
      console.error('[EPG] Persistent cache error:', err.message);
    }
  }

  saveDiskCache(xml) {
    const dir = path.dirname(this.cachePath);
    const tempPath = `${this.cachePath}.${process.pid}.tmp`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tempPath, xml, 'utf8');
    fs.renameSync(tempPath, this.cachePath);
  }

  async fetchSource(sourceUrl, useProxyObj = null) {
    const requestConfig = {
      timeout: 30000,
      responseType: 'arraybuffer',
      maxContentLength: 25 * 1024 * 1024,
      headers: {
        Accept: 'application/xml,text/xml,application/gzip,application/octet-stream,*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: `${new URL(sourceUrl).origin}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    };

    if (useProxyObj) {
      requestConfig.proxy = useProxyObj;
    }

    const response = await axios.get(sourceUrl, requestConfig);

    let payload = Buffer.from(response.data);
    const isGzip = sourceUrl.toLowerCase().endsWith('.gz') || (payload[0] === 0x1f && payload[1] === 0x8b);
    if (isGzip) payload = zlib.gunzipSync(payload);

    const xml = payload.toString('utf8').replace(/^\uFEFF/, '');
    if (!/^\s*<\?xml|^\s*<tv[\s>]/i.test(xml)) {
      throw new Error('source did not return XMLTV data');
    }
    return xml;
  }

  async fetchData() {
    if (this.fetchPromise) return this.fetchPromise;
    this.lastAttempt = Date.now();

    this.fetchPromise = (async () => {
      const failures = [];
      for (const sourceUrl of this.sourceUrls) {
        try {
          console.log('[EPG] Fetching EPG data from', sourceUrl);
          const xml = await this.fetchSource(sourceUrl);
          const parsed = this.parseEpg(xml, false);
          this.applyParsedEpg(parsed);
          this.saveDiskCache(xml);
          this.lastFetch = new Date();
          this.lastError = null;
          this.activeSource = sourceUrl;
          console.log(`[EPG] Parsed ${Object.keys(this.channels).length} channels and ${Object.keys(this.programs).length} schedules from ${sourceUrl}`);
          return;
        } catch (err) {
          failures.push(`${sourceUrl}: ${err.message}`);
          console.warn(`[EPG] Source failed (${sourceUrl}):`, err.message);

          // If the primary/direct vnepg.site URL failed (likely 403), try using a VN Proxy as fallback
          if (sourceUrl.includes('vnepg.site') && !err.message.includes('XMLTV')) {
            try {
              console.log('[EPG] Direct vnepg.site failed. Trying to fetch via Vietnam proxy pool...');
              const proxyListRes = await axios.get('https://proxylist.geonode.com/api/proxy-list?limit=15&page=1&sort_by=lastChecked&sort_type=desc&country=VN&protocols=http', { timeout: 8000 });
              const proxies = proxyListRes.data?.data || [];
              console.log(`[EPG] Found ${proxies.length} potential VN proxies.`);
              
              let proxySuccess = false;
              for (const p of proxies) {
                const proxyObj = { host: p.ip, port: parseInt(p.port) };
                console.log(`[EPG] Attempting vnepg.site via proxy http://${p.ip}:${p.port}...`);
                try {
                  const xml = await this.fetchSource(sourceUrl, proxyObj);
                  const parsed = this.parseEpg(xml, false);
                  this.applyParsedEpg(parsed);
                  this.saveDiskCache(xml);
                  this.lastFetch = new Date();
                  this.lastError = null;
                  this.activeSource = `${sourceUrl} (via proxy http://${p.ip}:${p.port})`;
                  console.log(`[EPG] Success via proxy! Parsed channels: ${Object.keys(this.channels).length}`);
                  proxySuccess = true;
                  break;
                } catch (proxyErr) {
                  console.warn(`[EPG] Proxy http://${p.ip}:${p.port} failed: ${proxyErr.message}`);
                }
              }
              if (proxySuccess) return;
            } catch (proxyPoolErr) {
              console.warn('[EPG] Proxy pool fetch failed:', proxyPoolErr.message);
            }
          }
        }
      }
      this.lastError = failures.join(' | ');
      console.error('[EPG] All sources failed, retaining previous cache:', this.lastError);
    })().finally(() => {
      this.fetchPromise = null;
    });

    return this.fetchPromise;
  }

  parseEpg(xmlData, apply = true) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const result = parser.parse(xmlData);
    if (!result || !result.tv) throw new Error('Invalid XMLTV document');

    const tv = result.tv;
    const nextChannels = {};
    const nextPrograms = {};
    const nextAliases = {};
    const nextChannelIds = {};
    let latestProgramStop = 0;

    const addAlias = (alias, channelId) => {
      for (const key of getAliasKeys(alias)) {
        if (!nextAliases[key]) nextAliases[key] = channelId;
      }
    };

    const channelList = Array.isArray(tv.channel) ? tv.channel : tv.channel ? [tv.channel] : [];
    channelList.forEach((channel) => {
      const id = channel['@_id'];
      if (!id) return;

      const displayName = getText(channel['display-name']) || id;
      nextChannels[id] = {
        id,
        name: displayName,
        icon: getIcon(channel.icon),
      };
      nextChannelIds[String(id).trim().toLowerCase()] = id;
      addAlias(id, id);
      addAlias(displayName, id);
    });

    const now = Date.now();
    const keepStart = now - 6 * 60 * 60 * 1000;  // 6 hours ago
    const keepEnd = now + 48 * 60 * 60 * 1000;   // 48 hours from now

    const programmeList = Array.isArray(tv.programme) ? tv.programme : tv.programme ? [tv.programme] : [];
    programmeList.forEach((programme) => {
      const channelId = programme['@_channel'];
      if (!channelId) return;

      const start = parseEpgTime(programme['@_start']);
      const stop = parseEpgTime(programme['@_stop']);
      if (!start || !stop || stop <= start) return;

      // Discard past or far future listings to save memory
      if (stop <= keepStart || start >= keepEnd) return;

      if (!nextPrograms[channelId]) nextPrograms[channelId] = [];
      latestProgramStop = Math.max(latestProgramStop, stop);

      nextPrograms[channelId].push({
        start,
        stop,
        title: getText(programme.title),
        desc: getText(programme.desc),
        icon: getIcon(programme.icon),
      });

      addAlias(channelId, channelId);
    });

    for (const channelId of Object.keys(nextPrograms)) {
      nextPrograms[channelId].sort((a, b) => a.start - b.start);
    }

    if (!Object.keys(nextPrograms).length) throw new Error('XMLTV contains no valid programmes');

    // Break references to help GC release memory
    if (tv) {
      tv.channel = null;
      tv.programme = null;
    }
    if (result) {
      result.tv = null;
    }

    const parsed = {
      channels: nextChannels,
      programs: nextPrograms,
      aliases: nextAliases,
      channelIds: nextChannelIds,
      latestProgramStop,
    };
    if (apply) this.applyParsedEpg(parsed);
    return parsed;
  }

  applyParsedEpg(parsed) {
    this.channels = parsed.channels;
    this.programs = parsed.programs;
    this.aliases = parsed.aliases;
    this.channelIds = parsed.channelIds;
  }

  resolveChannelId(channelId, channelName) {
    const candidates = [channelId, channelName].filter(Boolean);
    for (const candidate of candidates) {
      if (this.programs[candidate]) return candidate;
      const lower = String(candidate).trim().toLowerCase();
      if (this.programs[lower]) return lower;
      const exactId = this.channelIds[lower];
      if (exactId) return exactId;
      for (const key of getAliasKeys(candidate)) {
        const alias = this.aliases[key];
        if (alias && this.programs[alias]) return alias;
      }
    }
    return channelId;
  }

  getSchedule(channelId, options = {}) {
    const resolvedId = this.resolveChannelId(channelId, options.name);
    const progs = this.programs[resolvedId] || [];
    const now = Date.now();
    const limit = Math.max(1, Math.min(Number(options.limit || 30), 80));

    let current = null;
    let next = null;
    for (let i = 0; i < progs.length; i += 1) {
      const p = progs[i];
      if (now >= p.start && now < p.stop) {
        current = p;
        next = progs[i + 1] || null;
        break;
      }
      if (p.start > now) {
        next = p;
        break;
      }
    }

    const windowStart = now - 2 * 60 * 60 * 1000;
    const windowStop = now + 30 * 60 * 60 * 1000;
    const programs = progs
      .filter((p) => p.stop > windowStart && p.start < windowStop)
      .slice(0, limit);

    return {
      channel: this.channels[resolvedId] || { id: resolvedId || channelId, name: options.name || resolvedId || channelId },
      current,
      next,
      programs,
      source: this.activeSource || this.epgUrl,
      updatedAt: this.lastFetch ? this.lastFetch.toISOString() : null,
      error: this.lastError,
    };
  }

  getCurrentAndNext(channelId, options = {}) {
    return this.getSchedule(channelId, options);
  }
}

module.exports = new EpgService();
