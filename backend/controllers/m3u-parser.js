// M3U Parser for NhanChillTV Beta v1.4
const fs = require('fs');
const crypto = require('crypto');

const DEFAULT_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)';

function getHeaderValue(headerText, headerName) {
  if (!headerText) return null;

  const normalizedHeader = headerName.toLowerCase();
  try {
    const params = new URLSearchParams(headerText);
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase() === normalizedHeader && value) return value.trim();
    }
  } catch (e) {
    // Fall through to regex parsing for non-query formatted headers.
  }

  const match = headerText.match(new RegExp(`${headerName}=([^&|]+)`, 'i'));
  return match ? decodeURIComponent(match[1]).trim() : null;
}

function splitUrlAndHeaders(line) {
  const pipeIndex = line.indexOf('|');
  if (pipeIndex === -1) {
    return { url: line, userAgent: null, referer: null, origin: null };
  }

  const url = line.slice(0, pipeIndex).trim();
  const headerText = line.slice(pipeIndex + 1).trim();
  return {
    url,
    userAgent: getHeaderValue(headerText, 'User-Agent'),
    referer: getHeaderValue(headerText, 'Referer') || getHeaderValue(headerText, 'Referrer'),
    origin: getHeaderValue(headerText, 'Origin')
  };
}

function createStableChannelId(channel) {
  const fingerprint = [channel.group, channel.name, channel.url]
    .map(value => String(value || '').trim().toLowerCase())
    .join('|');
  return `ch_${crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 16)}`;
}

function normalizeHexKey(value) {
  const clean = String(value || '').trim().replace(/^0x/i, '').replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(clean) ? clean : null;
}

function base64KeyToHex(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const hex = Buffer.from(padded, 'base64').toString('hex').toLowerCase();
    return /^[0-9a-f]{32}$/.test(hex) ? hex : null;
  } catch (e) {
    return null;
  }
}

function normalizeClearKeyValue(value) {
  return normalizeHexKey(value) || base64KeyToHex(value);
}

function addClearKeyPair(clearKeys, kidValue, keyValue) {
  const kid = normalizeClearKeyValue(kidValue);
  const key = normalizeClearKeyValue(keyValue);
  if (kid && key) clearKeys[kid] = key;
}

function readJsonLike(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('{') && !raw.startsWith('[')) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    const closingIndex = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (closingIndex > 0) {
      try {
        return JSON.parse(raw.slice(0, closingIndex + 1));
      } catch (innerErr) {
        return null;
      }
    }
  }

  return null;
}

function collectClearKeysFromJson(value, clearKeys) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach(item => collectClearKeysFromJson(item, clearKeys));
    return;
  }

  if (typeof value !== 'object') return;

  const kid = value.kid || value.keyid || value.keyId || value.KID;
  const key = value.k || value.key || value.KEY || value.value;
  if (kid && key) addClearKeyPair(clearKeys, kid, key);

  if (value.keys) {
    if (Array.isArray(value.keys)) {
      value.keys.forEach(item => collectClearKeysFromJson(item, clearKeys));
    } else if (typeof value.keys === 'object') {
      Object.entries(value.keys).forEach(([entryKid, entryKey]) => {
        if (typeof entryKey === 'string') addClearKeyPair(clearKeys, entryKid, entryKey);
        else collectClearKeysFromJson(entryKey, clearKeys);
      });
    }
  }

  if (value.clearkey || value.clearKey || value.clearKeys) {
    collectClearKeysFromJson(value.clearkey || value.clearKey || value.clearKeys, clearKeys);
  }

  Object.entries(value).forEach(([entryKid, entryValue]) => {
    if (typeof entryValue === 'string') {
      addClearKeyPair(clearKeys, entryKid, entryValue);
    } else if (entryValue && typeof entryValue === 'object') {
      collectClearKeysFromJson(entryValue, clearKeys);
    }
  });
}

function collectClearKeysFromParams(value, clearKeys) {
  const raw = String(value || '').trim();
  if (!raw || !/[=&]/.test(raw)) return;

  try {
    const params = new URLSearchParams(raw.replace(/\|/g, '&'));
    const kid = params.get('kid') || params.get('keyid') || params.get('key_id') || params.get('KID');
    const key = params.get('key') || params.get('k') || params.get('KEY');
    if (kid && key) addClearKeyPair(clearKeys, kid, key);
  } catch (e) {
    // Ignore malformed query-like strings; regex parsing below may still catch them.
  }
}

function parseClearKeys(value) {
  const clearKeys = {};
  const raw = String(value || '').trim();
  if (!raw) return clearKeys;

  const json = readJsonLike(raw);
  if (json) collectClearKeysFromJson(json, clearKeys);

  collectClearKeysFromParams(raw, clearKeys);

  const pairPattern = /([0-9a-fA-F]{32}|[0-9a-fA-F-]{36}|[A-Za-z0-9_-]{22})\s*[:=]\s*([0-9a-fA-F]{32}|[0-9a-fA-F-]{36}|[A-Za-z0-9_-]{22})/g;
  let match;
  while ((match = pairPattern.exec(raw)) !== null) {
    addClearKeyPair(clearKeys, match[1], match[2]);
  }

  return clearKeys;
}

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
            id: tvgId || null,
            name: name || 'Unknown Channel',
            group: groupTitle,
            logo: tvgLogo,
            userAgent: DEFAULT_USER_AGENT,
            referer: null,
            origin: null,
            licenseType: null,
            clearKey: null,
            url: null
          };
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
          if (currentChannel) {
            currentChannel.userAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
          }
        } else if (line.startsWith('#EXTVLCOPT:http-referrer=') || line.startsWith('#EXTVLCOPT:http-referer=')) {
          if (currentChannel) {
            currentChannel.referer = line.replace(/^#EXTVLCOPT:http-referr?er=/, '').trim();
          }
        } else if (line.startsWith('#EXTVLCOPT:http-origin=')) {
          if (currentChannel) {
            currentChannel.origin = line.replace('#EXTVLCOPT:http-origin=', '').trim();
          }
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.stream_headers=')) {
          if (currentChannel) {
            const headerText = line.replace('#KODIPROP:inputstream.adaptive.stream_headers=', '').trim();
            const userAgent = getHeaderValue(headerText, 'User-Agent');
            const referer = getHeaderValue(headerText, 'Referer') || getHeaderValue(headerText, 'Referrer');
            const origin = getHeaderValue(headerText, 'Origin');
            if (userAgent) currentChannel.userAgent = userAgent;
            if (referer) currentChannel.referer = referer;
            if (origin) currentChannel.origin = origin;
          }
        } else if (line.startsWith('#EXTHTTP:')) {
          if (currentChannel) {
            try {
              const headers = JSON.parse(line.replace('#EXTHTTP:', '').trim());
              const userAgent = headers['User-Agent'] || headers['user-agent'];
              const referer = headers.Referer || headers.referer || headers.Referrer || headers.referrer;
              const origin = headers.Origin || headers.origin;
              if (userAgent) currentChannel.userAgent = String(userAgent).trim();
              if (referer) currentChannel.referer = String(referer).trim();
              if (origin) currentChannel.origin = String(origin).trim();
            } catch (e) {
              console.warn('[M3U Parser] EXTHTTP parse error:', e.message);
            }
          }
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
          if (currentChannel) {
            currentChannel.licenseType = line.replace('#KODIPROP:inputstream.adaptive.license_type=', '').trim().toLowerCase();
          }
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
          if (currentChannel) {
            const keyStr = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim();
            const clearKeys = parseClearKeys(keyStr);
            if (Object.keys(clearKeys).length > 0) {
              currentChannel.clearKey = clearKeys;
              if (!currentChannel.licenseType) currentChannel.licenseType = 'org.w3.clearkey';
            }
          }
        } else if (line && !line.startsWith('#') && currentChannel) {
          const parsedUrl = splitUrlAndHeaders(line);
          currentChannel.url = parsedUrl.url;
          if (parsedUrl.userAgent) currentChannel.userAgent = parsedUrl.userAgent;
          if (parsedUrl.referer) currentChannel.referer = parsedUrl.referer;
          if (parsedUrl.origin) currentChannel.origin = parsedUrl.origin;
          if (currentChannel.url) {
            if (!currentChannel.id) currentChannel.id = createStableChannelId(currentChannel);
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
