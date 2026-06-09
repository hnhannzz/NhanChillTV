const axios = require('axios');
const fs = require('fs');
const M3UParser = require('../controllers/m3u-parser');

class M3UManager {
  constructor(db) {
    this.db = db;
    this.channels = [];
    this.isRefreshing = false;
  }

  async refreshAll() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      console.log('[M3U Manager] Starting refresh of all sources...');
      const sources = this.db.getM3uSources().filter(s => s.active);
      let aggregatedChannels = [];

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
            console.log(`[M3U Manager] Reading file source: ${source.name} (${source.pathOrUrl})`);
            parsedChannels = M3UParser.parseFile(source.pathOrUrl);
          }
          
          // Modify IDs to ensure uniqueness if needed, or just append
          parsedChannels.forEach(ch => {
            // Option: append source ID to channel ID to prevent collisions
            // ch.id = `${source.id}_${ch.id}`;
            aggregatedChannels.push(ch);
          });
        } catch (err) {
          console.error(`[M3U Manager] Failed to load source ${source.name}:`, err.message);
        }
      }

      // Deduplicate by ID (keep the last one, or first one? Let's keep the first one found)
      const uniqueChannels = [];
      const seenIds = new Set();
      for (const ch of aggregatedChannels) {
        if (!seenIds.has(ch.id)) {
          seenIds.add(ch.id);
          uniqueChannels.push(ch);
        }
      }

      this.channels = uniqueChannels;
      console.log(`[M3U Manager] Refresh complete. Total unique channels: ${this.channels.length}`);
    } catch (err) {
      console.error('[M3U Manager] Refresh error:', err);
    } finally {
      this.isRefreshing = false;
    }
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
