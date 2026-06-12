const axios = require('axios');
const fs = require('fs');
const M3UParser = require('../controllers/m3u-parser');

class M3UManager {
  constructor(db) {
    this.db = db;
    this.channels = [];
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.refreshTimer = null;
    this.sourceChannels = new Map();
    this.lastAttemptAt = null;
    this.lastRefreshAt = null;
    this.lastError = null;
    this.sourceResults = [];
  }

  async refreshAll() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      this.isRefreshing = true;
      this.lastAttemptAt = new Date().toISOString();
      const sourceResults = [];
      const errors = [];

      try {
      console.log('[M3U Manager] Starting refresh of all sources...');
      const sources = this.db.getM3uSources().filter(s => s.active);
      const activeSourceIds = new Set(sources.map(source => source.id));

      for (const sourceId of this.sourceChannels.keys()) {
        if (!activeSourceIds.has(sourceId)) this.sourceChannels.delete(sourceId);
      }

      for (const source of sources) {
        try {
          let parsedChannels = [];
          if (source.type === 'url') {
            console.log(`[M3U Manager] Fetching URL source: ${source.name} (${source.url})`);
            const response = await axios.get(source.url, { 
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
              }
            });
            parsedChannels = M3UParser.parseString(response.data);
          } else if (source.type === 'file') {
            const filePath = source.pathOrUrl || source.url;
            console.log(`[M3U Manager] Reading file source: ${source.name} (${filePath})`);
            parsedChannels = M3UParser.parseFile(filePath);
          }

          this.sourceChannels.set(source.id, parsedChannels);
          sourceResults.push({ id: source.id, name: source.name, success: true, channels: parsedChannels.length });
        } catch (err) {
          console.error(`[M3U Manager] Failed to load source ${source.name}:`, err.message);
          errors.push(`${source.name}: ${err.message}`);
          sourceResults.push({
            id: source.id,
            name: source.name,
            success: false,
            channels: this.sourceChannels.get(source.id)?.length || 0,
            error: err.message
          });
        }
      }

      const aggregatedChannels = sources.flatMap(source => this.sourceChannels.get(source.id) || []);

      const uniqueChannels = [];
      const seenIds = new Set();
      for (const ch of aggregatedChannels) {
        // Lọc bỏ hoàn toàn các nguồn hoiquan.click / hoiquan.dpdns.org vì họ dùng Cloudflare block IP Datacenter và không hỗ trợ CORS trên trình duyệt
        if (ch.url && ch.url.includes('hoiquan')) {
          continue;
        }

        if (!seenIds.has(ch.id)) {
          seenIds.add(ch.id);
          uniqueChannels.push(ch);
        }
      }

      this.channels = uniqueChannels;
      this.lastRefreshAt = new Date().toISOString();
      this.lastError = errors.length ? errors.join('; ') : null;
      this.sourceResults = sourceResults;
      console.log(`[M3U Manager] Refresh complete. Total unique channels: ${this.channels.length}`);
      return this.getStatus();
      } catch (err) {
        this.lastError = err.message;
        console.error('[M3U Manager] Refresh error:', err);
        throw err;
      } finally {
        this.isRefreshing = false;
      }
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  startAutoRefresh(intervalMs = 60 * 60 * 1000) {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      this.refreshAll().catch(err => {
        console.error('[M3U Manager] Scheduled refresh failed:', err.message);
      });
    }, intervalMs);
    this.refreshTimer.unref?.();
  }

  getStatus() {
    return {
      isRefreshing: this.isRefreshing,
      channelsCount: this.channels.length,
      lastAttemptAt: this.lastAttemptAt,
      lastRefreshAt: this.lastRefreshAt,
      lastError: this.lastError,
      sources: this.sourceResults
    };
  }

  getChannels() {
    return this.channels;
  }

  getChannelById(id) {
    return this.channels.find(ch => ch.id === id);
  }

  getChannelsByGroup(group) {
    return this.channels.filter(ch => ch.group === group);
  }

  getAllGroups() {
    return [...new Set(this.channels.map(ch => ch.group))];
  }
}

const Database = require('../db/database');
const config = require('../config');

// Singleton instance
const db = new Database(config.dbPath);
const m3uManager = new M3UManager(db);

module.exports = m3uManager;
