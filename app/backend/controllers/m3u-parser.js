// M3U Parser for NhanChillTV Beta v1.4
const fs = require('fs');

class M3UParser {
  static parseString(content) {
    if (!content) return [];
    try {
      const lines = content.split('\n');
      const channels = [];
      let currentChannel = null;

      lines.forEach((line, idx) => {
        line = line.trim();
        
        if (line.startsWith('#EXTINF:')) {
          const tvgId = (line.match(/tvg-id="([^"]+)"/) || [])[1] || '';
          const groupTitle = (line.match(/group-title="([^"]+)"/) || [])[1] || 'Other';
          const tvgLogo = (line.match(/tvg-logo="([^"]+)"/) || [])[1] || '';
          const name = line.split(',').slice(1).join(',').trim();
          
          currentChannel = {
            id: tvgId || `ch_${idx}_${Date.now()}`,
            name: name || 'Unknown Channel',
            group: groupTitle,
            logo: tvgLogo,
            userAgent: 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)', // Kodi/Dalvik Emulator default
            clearKey: null,
            url: null
          };
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
          if (currentChannel) {
            currentChannel.userAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
          }
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
          if (currentChannel) {
            const keyStr = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim();
            let clearKeys = {};
            if (keyStr.startsWith('{')) {
              try {
                const parsed = JSON.parse(keyStr);
                if (parsed.keys && Array.isArray(parsed.keys)) {
                  parsed.keys.forEach(k => {
                    const kid = k.kid.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    const keyVal = k.k.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    clearKeys[kid] = keyVal;
                  });
                }
              } catch (e) { console.error('ClearKey parse error', e); }
            } else if (keyStr.includes(':')) {
              const parts = keyStr.split(':');
              if (parts.length === 2) {
                const kid = Buffer.from(parts[0], 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                const keyVal = Buffer.from(parts[1], 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                clearKeys[kid] = keyVal;
              }
            }
            if (Object.keys(clearKeys).length > 0) {
              currentChannel.clearKey = clearKeys;
            }
          }
        } else if (line && !line.startsWith('#') && currentChannel) {
          currentChannel.url = line;
          if (currentChannel.url) {
            channels.push(currentChannel);
          }
          currentChannel = null;
        }
      });

      console.log(`[M3U Parser] Parsed ${channels.length} channels.`);
      return channels;
    } catch (err) {
      console.error('[M3U Parser] Parse error:', err);
      return [];
    }
  }

  static parseFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn('[M3U Parser] File not found:', filePath);
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseString(content);
  }
}

module.exports = M3UParser;
