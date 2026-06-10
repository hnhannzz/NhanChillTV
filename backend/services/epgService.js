const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const DEFAULT_EPG_URL = 'https://vnepg.site/epg.xml';

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
    this.channels = {};
    this.programs = {};
    this.aliases = {};
    this.lastFetch = null;
    this.lastError = null;
    this.fetchPromise = null;
    this.fetchInterval = Number(process.env.EPG_CACHE_TTL_MS || 60 * 60 * 1000);

    this.fetchData();
    setInterval(() => this.fetchData(), this.fetchInterval);
  }

  async ensureData() {
    if (this.lastFetch && Date.now() - this.lastFetch.getTime() < this.fetchInterval && Object.keys(this.programs).length > 0) {
      return;
    }
    await this.fetchData();
  }

  async fetchData() {
    if (this.fetchPromise) return this.fetchPromise;

    const requestUrl = new URL(this.epgUrl);
    requestUrl.searchParams.set('_', Date.now());

    this.fetchPromise = axios
      .get(requestUrl.toString(), {
        timeout: 60000,
        responseType: 'arraybuffer',
        maxContentLength: 25 * 1024 * 1024,
        headers: {
          Accept: 'application/xml,text/xml,*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        },
      })
      .then((response) => {
        console.log('[EPG] Fetching EPG data from', this.epgUrl);
        const xml = Buffer.from(response.data).toString('utf8').replace(/^\uFEFF/, '');
        this.parseEpg(xml);
        this.lastFetch = new Date();
        this.lastError = null;
        console.log(`[EPG] Parsed ${Object.keys(this.channels).length} channels and ${Object.keys(this.programs).length} schedules`);
      })
      .catch((err) => {
        this.lastError = err.message;
        console.error('[EPG] Fetch error, retaining previous cache:', err.message);
      })
      .finally(() => {
        this.fetchPromise = null;
      });

    return this.fetchPromise;
  }

  parseEpg(xmlData) {
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
      addAlias(id, id);
      addAlias(displayName, id);
    });

    const programmeList = Array.isArray(tv.programme) ? tv.programme : tv.programme ? [tv.programme] : [];
    programmeList.forEach((programme) => {
      const channelId = programme['@_channel'];
      if (!channelId) return;

      if (!nextPrograms[channelId]) nextPrograms[channelId] = [];
      const start = parseEpgTime(programme['@_start']);
      const stop = parseEpgTime(programme['@_stop']);
      if (!start || !stop || stop <= start) return;

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

    this.channels = nextChannels;
    this.programs = nextPrograms;
    this.aliases = nextAliases;
  }

  resolveChannelId(channelId, channelName) {
    const candidates = [channelId, channelName].filter(Boolean);
    for (const candidate of candidates) {
      if (this.programs[candidate]) return candidate;
      const lower = String(candidate).toLowerCase();
      if (this.programs[lower]) return lower;
      const exactId = Object.keys(this.programs).find(id => id.toLowerCase() === lower);
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
      source: this.epgUrl,
      updatedAt: this.lastFetch ? this.lastFetch.toISOString() : null,
      error: this.lastError,
    };
  }

  getCurrentAndNext(channelId, options = {}) {
    return this.getSchedule(channelId, options);
  }
}

module.exports = new EpgService();
