const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

class EpgService {
  constructor() {
    this.epgUrl = 'https://vnepg.site/epg.xml';
    this.channels = {};
    this.programs = {};
    this.lastFetch = null;
    this.fetchInterval = 60 * 60 * 1000; // 1 hour
    
    // Start fetching loop
    this.fetchData();
    setInterval(() => this.fetchData(), this.fetchInterval);
  }

  async fetchData() {
    try {
      console.log('[EPG] Fetching EPG data from', this.epgUrl);
      const response = await axios.get(this.epgUrl, { timeout: 30000 });
      this.parseEpg(response.data);
      this.lastFetch = new Date();
      console.log('[EPG] Data fetched and parsed successfully');
    } catch (err) {
      console.error('[EPG] Fetch error:', err.message);
    }
  }

  parseEpg(xmlData) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    
    const result = parser.parse(xmlData);
    if (!result || !result.tv) return;

    const tv = result.tv;
    
    this.programs = {};
    if (tv.programme) {
      const progList = Array.isArray(tv.programme) ? tv.programme : [tv.programme];
      progList.forEach(prog => {
        const channelId = prog['@_channel'];
        if (!channelId) return;
        
        if (!this.programs[channelId]) {
          this.programs[channelId] = [];
        }
        
        const parseTime = (timeStr) => {
          if (!timeStr) return 0;
          const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
          if (!match) return 0;
          const [_, y, m, d, h, min, s, tz] = match;
          // EPG timezone is usually +0700 for VN
          const iso = `${y}-${m}-${d}T${h}:${min}:${s}${tz || '+0700'}`;
          return new Date(iso).getTime();
        };

        const getVal = (node) => {
          if (!node) return '';
          if (typeof node === 'string') return node;
          if (node['#text']) return node['#text'];
          return '';
        };

        this.programs[channelId].push({
          start: parseTime(prog['@_start']),
          stop: parseTime(prog['@_stop']),
          title: getVal(prog.title),
          desc: getVal(prog.desc)
        });
      });
      
      for (const ch in this.programs) {
        this.programs[ch].sort((a, b) => a.start - b.start);
      }
    }
  }

  getCurrentAndNext(channelId) {
    if (!this.programs[channelId]) return { current: null, next: null };
    
    const now = Date.now();
    const progs = this.programs[channelId];
    
    let current = null;
    let next = null;
    
    for (let i = 0; i < progs.length; i++) {
      const p = progs[i];
      if (now >= p.start && now < p.stop) {
        current = p;
        if (i + 1 < progs.length) {
          next = progs[i + 1];
        }
        break;
      } else if (p.start > now && !current) {
        next = p;
        break;
      }
    }
    
    return { current, next };
  }
}

module.exports = new EpgService();
