const axios = require('axios');

const DEFAULT_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)';
const DETECTION_CACHE_TTL_MS = Number(process.env.STREAM_TYPE_CACHE_TTL_MS || 20000);
const DETECTION_TIMEOUT_MS = Number(process.env.STREAM_TYPE_DETECT_TIMEOUT_MS || 3500);
const detectionCache = new Map();

function classifyFromUrl(url, hasClearKey = false) {
  const lowerUrl = String(url || '').toLowerCase();
  if (lowerUrl.includes('.mpd')) return { kind: 'mpd', isMpd: true, isHls: false, isProgressive: false, source: 'url' };
  if (lowerUrl.includes('.m3u8')) return { kind: 'hls', isMpd: false, isHls: true, isProgressive: false, source: 'url' };
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('.m4v')) return { kind: 'progressive', isMpd: false, isHls: false, isProgressive: true, source: 'url' };
  if (hasClearKey) return { kind: 'mpd', isMpd: true, isHls: false, isProgressive: false, source: 'clearkey-fallback' };
  return { kind: 'unknown', isMpd: false, isHls: false, isProgressive: false, source: 'unknown' };
}

function classifyPlaybackResponse({ url, finalUrl, contentType, body }) {
  const lowerUrl = String(url || '').toLowerCase();
  const lowerFinalUrl = String(finalUrl || '').toLowerCase();
  const type = String(contentType || '').toLowerCase();
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
  const sample = text.slice(0, 4096);

  if (sample.includes('#EXTM3U') || sample.includes('#EXT-X-')) {
    return { kind: 'hls', isMpd: false, isHls: true, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (sample.includes('<MPD')) {
    return { kind: 'mpd', isMpd: true, isHls: false, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (type.includes('mpegurl')) {
    return { kind: 'hls', isMpd: false, isHls: true, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (type.includes('dash+xml')) {
    return { kind: 'mpd', isMpd: true, isHls: false, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (lowerFinalUrl.includes('.m3u8')) {
    return { kind: 'hls', isMpd: false, isHls: true, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (lowerFinalUrl.includes('.mpd')) {
    return { kind: 'mpd', isMpd: true, isHls: false, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (type.includes('video/mp2t') || lowerFinalUrl.includes('.ts')) {
    return { kind: 'mpegts', isMpd: false, isHls: false, isProgressive: false, source: 'sniff', finalUrl };
  }

  if (type.includes('video/mp4') || lowerFinalUrl.includes('.mp4') || lowerUrl.includes('.mp4')) {
    return { kind: 'progressive', isMpd: false, isHls: false, isProgressive: true, source: 'sniff', finalUrl };
  }

  return { kind: 'unknown', isMpd: false, isHls: false, isProgressive: false, source: 'sniff', finalUrl };
}

function shouldProbeUrl(channel) {
  const url = String(channel?.url || '');
  const lowerUrl = url.toLowerCase();
  if (!url.startsWith('http')) return false;
  if (channel?.clearKey) return true;
  if (lowerUrl.includes('.php') || lowerUrl.includes('/api/') || lowerUrl.includes('redirect')) return true;
  return !/\.(m3u8|mpd|mp4|m4v)(\?|$)/i.test(lowerUrl);
}

async function fetchPlaybackSample(channel, timeoutMs = DETECTION_TIMEOUT_MS) {
  const url = String(channel?.url || '');
  const response = await axios.get(url, {
    headers: {
      Range: 'bytes=0-4095',
      'User-Agent': channel.userAgent || DEFAULT_USER_AGENT,
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      'X-Requested-With': 'org.xbmc.kodi',
    },
    responseType: 'arraybuffer',
    transformResponse: data => data,
    maxRedirects: 8,
    timeout: timeoutMs,
    validateStatus: status => status >= 200 && status < 500,
  });

  return {
    url,
    finalUrl: response.request?.res?.responseUrl || url,
    contentType: response.headers?.['content-type'] || '',
    body: Buffer.from(response.data || ''),
    status: response.status,
  };
}

async function detectChannelPlaybackType(channel, options = {}) {
  const fallback = classifyFromUrl(channel?.url, Boolean(channel?.clearKey));
  if (!shouldProbeUrl(channel)) return fallback;

  const cacheKey = [
    channel.url,
    channel.userAgent || DEFAULT_USER_AGENT,
    Boolean(channel.clearKey),
  ].join('|');
  const cached = detectionCache.get(cacheKey);
  const now = Date.now();
  if (!options.force && cached && (now - cached.at) < DETECTION_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const sample = await fetchPlaybackSample(channel, options.timeoutMs);
    const detected = classifyPlaybackResponse(sample);
    const value = detected.kind === 'unknown' ? { ...fallback, finalUrl: sample.finalUrl, source: fallback.source } : detected;
    detectionCache.set(cacheKey, { at: now, value });
    return value;
  } catch (err) {
    const value = { ...fallback, error: err.message, source: fallback.source };
    detectionCache.set(cacheKey, { at: now, value });
    return value;
  }
}

module.exports = {
  classifyFromUrl,
  classifyPlaybackResponse,
  detectChannelPlaybackType,
};
