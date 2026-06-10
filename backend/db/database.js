// Simple JSON Database for NhanChillTV Beta v1.3
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.dbPath)) {
      this.write({
        users: [],
        favorites: [],
        events: [],
        m3uSources: [
          {
            id: `src_${Date.now()}`,
            name: 'Default Server Source',
            type: 'url',
            url: 'https://tinyurl.com/vmt47',
            active: true,
            createdAt: new Date().toISOString()
          }
        ],
        iptvSettings: {
          hiddenGroups: [],
          hiddenChannels: [],
          groupOrder: []
        }
      });
    } else {
      // Migrate old database formats if needed
      const data = this.read();
      if (!data.m3uSources) {
        data.m3uSources = [
          {
            id: `src_${Date.now()}`,
            name: 'Default Server Source',
            type: 'url',
            url: 'https://tinyurl.com/vmt47',
            active: true,
            createdAt: new Date().toISOString()
          }
        ];
        this.write(data);
      }
      if (!data.iptvSettings) {
        data.iptvSettings = {
          hiddenGroups: [],
          hiddenChannels: [],
          groupOrder: []
        };
        this.write(data);
      }
      if (!Array.isArray(data.favorites)) {
        data.favorites = [];
        this.write(data);
      }
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
  }

  write(data) {
    const tempPath = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, this.dbPath);
  }

  getEvents() {
    return this.read().events || [];
  }

  addEvent(event) {
    const data = this.read();
    event.id = Date.now().toString();
    data.events.push(event);
    this.write(data);
    return event;
  }

  updateEvent(id, updates) {
    const data = this.read();
    const idx = data.events.findIndex(e => e.id === id);
    if (idx !== -1) {
      data.events[idx] = { ...data.events[idx], ...updates };
      this.write(data);
      return data.events[idx];
    }
    return null;
  }

  deleteEvent(id) {
    const data = this.read();
    data.events = data.events.filter(e => e.id !== id);
    this.write(data);
  }

  getM3uSources() {
    return this.read().m3uSources || [];
  }

  addM3uSource(source) {
    const data = this.read();
    if (!data.m3uSources) data.m3uSources = [];
    data.m3uSources.push(source);
    this.write(data);
    return source;
  }

  deleteM3uSource(id) {
    const data = this.read();
    if (data.m3uSources) {
      data.m3uSources = data.m3uSources.filter(s => s.id !== id);
      this.write(data);
    }
  }

  updateM3uSource(id, updates) {
    const data = this.read();
    if (!data.m3uSources) return null;
    const idx = data.m3uSources.findIndex(s => s.id === id);
    if (idx !== -1) {
      data.m3uSources[idx] = { ...data.m3uSources[idx], ...updates };
      this.write(data);
      return data.m3uSources[idx];
    }
    return null;
  }

  getFavorites() {
    return this.read().favorites;
  }

  toggleFavorite(channelId) {
    const data = this.read();
    const idx = data.favorites.indexOf(channelId);
    if (idx === -1) data.favorites.push(channelId);
    else data.favorites.splice(idx, 1);
    this.write(data);
    return data.favorites;
  }
  getIptvSettings() {
    const data = this.read();
    return data.iptvSettings || { hiddenGroups: [], hiddenChannels: [], groupOrder: [] };
  }

  updateIptvSettings(settings) {
    const data = this.read();
    data.iptvSettings = { ...data.iptvSettings, ...settings };
    this.write(data);
    return data.iptvSettings;
  }

  verifyAdminPassword(password, fallbackPassword) {
    const settings = this.read().adminSettings;
    if (!settings?.passwordHash || !settings?.passwordSalt) {
      return String(password || '') === String(fallbackPassword || '');
    }
    const actual = crypto.scryptSync(String(password || ''), settings.passwordSalt, 64);
    const expected = Buffer.from(settings.passwordHash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  setAdminPassword(password) {
    const data = this.read();
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    data.adminSettings = {
      passwordSalt,
      passwordHash: crypto.scryptSync(String(password), passwordSalt, 64).toString('hex'),
      updatedAt: new Date().toISOString()
    };
    this.write(data);
  }
}

module.exports = Database;
