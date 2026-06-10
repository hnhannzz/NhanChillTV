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

    this.fetchPromise = axios
      .get(this.epgUrl, {
        timeout: 30000,
        responseType: 'text',
        headers: {
          Accept: 'application/xml,text/xml,*/*',
          'User-Agent': 'NhanChillTV/1.0',
        },
      })
      .then((response) => {
        console.log('[EPG] Fetching EPG data from', this.epgUrl);
        this.parseEpg(response.data);
        this.lastFetch = new Date();
        console.log('[EPG] Data fetched and parsed successfully');
      })
      .catch((err) => {
        console.error('[EPG] Fetch error:', err.message);
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
    if (!result || !result.tv) return;

    const tv = result.tv;
    const nextChannels = {};
    const nextPrograms = {};
    const nextAliases = {};

    const addAlias = (alias, channelId) => {
      const key = normalizeKey(alias);
      if (key && !nextAliases[key]) nextAliases[key] = channelId;
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
      nextPrograms[channelId].push({
        start: parseEpgTime(programme['@_start']),
        stop: parseEpgTime(programme['@_stop']),
        title: getText(programme.title),
        desc: getText(programme.desc),
        icon: getIcon(programme.icon),
      });

      addAlias(channelId, channelId);
    });

    for (const channelId of Object.keys(nextPrograms)) {
      nextPrograms[channelId].sort((a, b) => a.start - b.start);
    }

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
      const alias = this.aliases[normalizeKey(candidate)];
      if (alias && this.programs[alias]) return alias;
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
    };
  }

  getCurrentAndNext(channelId, options = {}) {
    return this.getSchedule(channelId, options);
  }
}

module.exports = new EpgService();
