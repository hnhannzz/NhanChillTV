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

      const normalizeName = (name) => {
        return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      };

      const channelsByKey = new Map();
      for (const ch of aggregatedChannels) {
        // Lọc bỏ hoàn toàn các nguồn hoiquan.click / hoiquan.dpdns.org vì họ dùng Cloudflare block IP Datacenter và không hỗ trợ CORS trên trình duyệt
        if (ch.url && ch.url.includes('hoiquan')) {
          continue;
        }
        const key = ch.id && !ch.id.startsWith('ch_') ? ch.id.toLowerCase() : normalizeName(ch.name);
        if (!channelsByKey.has(key)) {
          channelsByKey.set(key, []);
        }
        channelsByKey.get(key).push(ch);
      }

      const uniqueChannels = [];
      for (const [key, group] of channelsByKey.entries()) {
        if (group.length === 1) {
          uniqueChannels.push(group[0]);
        } else {
          // Nếu có nhiều luồng cho cùng một kênh, ưu tiên luồng HLS (.m3u8) để không tốn tài nguyên transcode
          const hlsChannel = group.find(ch => String(ch.url || '').toLowerCase().includes('.m3u8'));
          if (hlsChannel) {
            uniqueChannels.push(hlsChannel);
          } else {
            uniqueChannels.push(group[0]);
          }
        }
      }

      this.channels = uniqueChannels;
      this.lastRefreshAt = new Date().toISOString();
      this.lastError = errors.length ? errors.join('; ') : null;
      this.sourceResults = sourceResults;
      console.log(`[M3U Manager] Refresh complete. Total unique channels: ${this.channels.length}`);
      
      // Khởi chạy tiến trình dò quét ngầm tuần tự các kênh udpxy nghi vấn
      setTimeout(() => this.probeSuspectChannels().catch(err => console.error('[M3U Manager] Probe suspects error:', err.message)), 2000);
      
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

  async probeSuspectChannels() {
    const suspects = this.channels.filter(ch => {
      const lower = String(ch.url || '').toLowerCase();
      return lower.includes('/tqvudp/') || lower.includes('/udp/') || lower.includes('.ts') || lower.startsWith('udp://');
    });

    if (suspects.length === 0) return;
    console.log(`[M3U Manager] Found ${suspects.length} suspected udpxy/MPEG-TS channels. Starting throttled background probe...`);

    const ffmpegWrapper = require('../../ffmpeg-core/wrapper');

    for (const ch of suspects) {
      // Dò quét tuần tự từng kênh cách nhau 3 giây để tránh làm vọt CPU của VPS 1GB RAM
      try {
        const info = await ffmpegWrapper.getStreamInfo(ch.id, ch);
        ch.audioCodec = info.audioCodec;
        ch.videoCodec = info.videoCodec;
        if (info.audioCodec === 'mp2') {
          ch.isUdpxyMp2 = true;
          console.log(`[M3U Manager] Detected udpxy+mp2 channel: ${ch.name} (${ch.id})`);
        }
      } catch (err) {
        console.warn(`[M3U Manager] Background probe failed for ${ch.name}:`, err.message);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`[M3U Manager] Background probe completed.`);
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
    const settings = this.db.getIptvSettings();
    const customLogos = settings.customLogos || {};
    return this.channels.map(c => {
      const key = c.id || String(c.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      const customUrl = customLogos[key] || customLogos[String(key).toLowerCase()];
      if (customUrl) {
        return { ...c, logo: customUrl };
      }
      return c;
    });
  }

  getChannelById(id) {
    const channel = this.channels.find(ch => ch.id === id);
    if (!channel) return null;
    const settings = this.db.getIptvSettings();
    const customLogos = settings.customLogos || {};
    const key = channel.id || String(channel.name).toLowerCase().replace(/[^a-z0-9]/g, '');
    const customUrl = customLogos[key] || customLogos[String(key).toLowerCase()];
    if (customUrl) {
      return { ...channel, logo: customUrl };
    }
    return channel;
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
