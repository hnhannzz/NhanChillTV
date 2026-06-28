const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { encryptUrl, decryptUrl } = require('../utils/cryptoHelper');
const router = express.Router();

const MAX_PROXY_SOCKETS = Number(process.env.PROXY_MAX_SOCKETS || 256);
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 45000);
const PROXY_LOG_REQUESTS = process.env.PROXY_LOG_REQUESTS === 'true';

const keepAliveAgentOptions = {
  keepAlive: true,
  maxSockets: MAX_PROXY_SOCKETS,
  maxFreeSockets: Math.min(64, MAX_PROXY_SOCKETS),
  keepAliveMsecs: 10000,
  timeout: PROXY_TIMEOUT_MS,
};

const httpKeepAliveAgent = new http.Agent(keepAliveAgentOptions);
const httpsKeepAliveAgent = new https.Agent(keepAliveAgentOptions);

function getAbsoluteUrl(baseUrl, targetUrl) {
  try {
    return new URL(targetUrl, baseUrl).href;
  } catch (e) {
    return targetUrl;
  }
}

const DEFAULT_USER_AGENT_FOR_PROXY = 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)';
const INTERNAL_QUERY_PARAMS = new Set(['ua', 'pt', 'ref', 'origin']);

function appendForwardedQuery(targetUrl, req) {
  const params = new URLSearchParams(req.query);
  for (const key of INTERNAL_QUERY_PARAMS) {
    params.delete(key);
  }

  const query = params.toString();
  if (!query) return targetUrl;
  return targetUrl + (targetUrl.includes('?') ? '&' : '?') + query;
}

function appendQueryParam(url, key, value) {
  if (!value) return url;
  return url + (url.includes('?') ? '&' : '?') + `${key}=${encodeURIComponent(value)}`;
}

function appendProxyHeaders(url, customHeaders = {}) {
  let nextUrl = url;
  nextUrl = appendQueryParam(nextUrl, 'ua', customHeaders.userAgent);
  nextUrl = appendQueryParam(nextUrl, 'ref', customHeaders.referer);
  nextUrl = appendQueryParam(nextUrl, 'origin', customHeaders.origin);
  return nextUrl;
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeXmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttribute(value) {
  return escapeXmlText(value).replace(/"/g, '&quot;');
}

function shouldRewriteXmlUrl(url) {
  const clean = decodeXmlEntities(url).trim();
  if (!clean || clean.startsWith('#')) return false;
  if (/^(urn|data|mailto|javascript):/i.test(clean)) return false;
  return true;
}

function maskUrlForLog(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch (e) {
    return String(url || '').split('?')[0].slice(0, 180);
  }
}

function resolveAbsoluteUrl(baseUrl, origin, url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return origin + url;
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return origin + '/' + url;
  }
}

function decodeManifestBuffer(buffer, encoding) {
  const normalized = String(encoding || '').toLowerCase();
  if (normalized.includes('gzip')) return zlib.gunzipSync(buffer);
  if (normalized.includes('br')) return zlib.brotliDecompressSync(buffer);
  if (normalized.includes('deflate')) return zlib.inflateSync(buffer);
  return buffer;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidManifestContent(content, expectedType) {
  if (expectedType === 'mpd') return content.includes('<MPD');
  if (expectedType === 'hls') return content.includes('#EXTM3U');
  return true;
}

function readStreamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function createProxyHeaders(targetUrl, req, customHeaders = {}) {
  const isFptOrVtv = targetUrl.includes('fptplay') || targetUrl.includes('vtv') || targetUrl.includes('vtvgo');
  const browserUa = req.headers['user-agent'];
  const fallbackUa = browserUa?.includes('Mozilla') ? DEFAULT_USER_AGENT_FOR_PROXY : (browserUa || DEFAULT_USER_AGENT_FOR_PROXY);
  const defaultReferer = isFptOrVtv ? undefined : (new URL(targetUrl).origin + '/');

  return {
    'User-Agent': customHeaders.userAgent || (isFptOrVtv ? 'VLC/3.0.16 LibVLC/3.0.16' : fallbackUa),
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'X-Requested-With': isFptOrVtv ? undefined : 'org.xbmc.kodi',
    'Origin': customHeaders.origin || undefined,
    'Referer': customHeaders.referer || defaultReferer,
    'X-Forwarded-For': `14.169.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    'X-Real-IP': `14.169.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    'Range': req.headers.range
  };
}

function fetchProxyResponse(targetUrl, req, customHeaders, controller) {
  return axios({
    method: 'GET',
    url: targetUrl,
    signal: controller.signal,
    httpAgent: httpKeepAliveAgent,
    httpsAgent: httpsKeepAliveAgent,
    headers: createProxyHeaders(targetUrl, req, customHeaders),
    responseType: 'stream',
    decompress: false,
    maxRedirects: 10,
    timeout: PROXY_TIMEOUT_MS,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });
}

// Xử lý OPTIONS (preflight CORS)
router.options('/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
    'Access-Control-Max-Age': '86400'
  });
  res.sendStatus(204);
});

router.get('/resolve', (req, res) => {
  const targetUrl = String(req.query.url || '');
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ success: false, error: 'Invalid URL' });
  }

  const encryptedUrl = encryptUrl(targetUrl);
  let proxiedUrl = encryptedUrl ? `/api/proxy/${encryptedUrl}` : `/api/proxy/${targetUrl}`;

  if (req.query.ua) {
    proxiedUrl += `${proxiedUrl.includes('?') ? '&' : '?'}ua=${encodeURIComponent(req.query.ua)}`;
  }
  if (req.query.ref) {
    proxiedUrl += `${proxiedUrl.includes('?') ? '&' : '?'}ref=${encodeURIComponent(req.query.ref)}`;
  }
  if (req.query.origin) {
    proxiedUrl += `${proxiedUrl.includes('?') ? '&' : '?'}origin=${encodeURIComponent(req.query.origin)}`;
  }
  if (['mpd', 'hls'].includes(req.query.pt)) {
    proxiedUrl += `${proxiedUrl.includes('?') ? '&' : '?'}pt=${encodeURIComponent(req.query.pt)}`;
  }

  return res.json({ success: true, url: proxiedUrl });
});

async function handleProxyRequest(req, res) {
  let targetUrl = req.params[0];
  try {
    targetUrl = targetUrl.replace(/^(https?):\/+/, '$1://');

    if (!targetUrl.startsWith('http')) {
      const parts = targetUrl.split('/');
      if (parts.length > 1) {
        const decryptedBase = decryptUrl(parts[0]);
        if (decryptedBase && decryptedBase.startsWith('http')) {
          targetUrl = decryptedBase + '/' + parts.slice(1).join('/');
        } else {
          targetUrl = decryptUrl(targetUrl) || targetUrl;
        }
      } else {
        targetUrl = decryptUrl(targetUrl) || targetUrl;
      }
    }

    targetUrl = appendForwardedQuery(targetUrl, req);
    if (!targetUrl.startsWith('http')) {
      return res.status(400).send('Invalid URL');
    }

    if (PROXY_LOG_REQUESTS) {
      console.log('[Proxy] Fetching:', targetUrl);
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const customHeaders = {
      userAgent: req.query.ua ? String(req.query.ua) : null,
      referer: req.query.ref ? String(req.query.ref) : null,
      origin: req.query.origin ? String(req.query.origin) : null,
    };
    const expectedType = ['mpd', 'hls'].includes(req.query.pt) ? req.query.pt : null;
    let response = await fetchProxyResponse(targetUrl, req, customHeaders, controller);
    let contentType = response.headers['content-type'] || '';
    let finalUrl = response.request?.res?.responseUrl || targetUrl;

    if (response.status >= 400) {
      console.warn('[Proxy] Upstream HTTP error', {
        status: response.status,
        type: contentType || 'unknown',
        url: maskUrlForLog(finalUrl || targetUrl),
      });
    }

    const lowerUrl = targetUrl.toLowerCase();
    const isM3u8 = expectedType === 'hls' || lowerUrl.includes('.m3u8') || contentType.includes('mpegurl');
    const isMpd = expectedType === 'mpd' || lowerUrl.includes('.mpd') || contentType.includes('dash+xml');
    const isManifest = isM3u8 || isMpd;

    if (isManifest) {
      const proxyBase = `/api/proxy/`;
      let content = '';
      let manifestStatus = response.status;
      let manifestContentType = contentType;
      let manifestFinalUrl = finalUrl;

      for (let attempt = 0; attempt < 3; attempt++) {
        const decoded = decodeManifestBuffer(await readStreamToBuffer(response.data), response.headers['content-encoding']);
        content = decoded.toString('utf-8');
        manifestStatus = response.status;
        manifestContentType = response.headers['content-type'] || '';
        manifestFinalUrl = response.request?.res?.responseUrl || targetUrl;

        if (!expectedType || isValidManifestContent(content, expectedType) || attempt === 2) {
          break;
        }

        console.warn(`[Proxy] ${expectedType.toUpperCase()} manifest retry ${attempt + 1} for transient upstream response: ${manifestContentType || 'unknown'}`);
        await delay(250 + attempt * 250);
        response = await fetchProxyResponse(targetUrl, req, customHeaders, controller);
      }

      if (expectedType && !isValidManifestContent(content, expectedType)) {
        res.set({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
          'Content-Type': expectedType === 'mpd' ? 'application/dash+xml' : 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        return res.status(502).send(`Invalid ${expectedType.toUpperCase()} manifest from upstream`);
      }

      const originOfFinalUrl = new URL(manifestFinalUrl).origin;
      if (isM3u8) {
        content = rewriteM3u8(content, manifestFinalUrl, proxyBase, originOfFinalUrl, customHeaders);
      } else if (isMpd) {
        content = rewriteMpd(content, manifestFinalUrl, proxyBase, originOfFinalUrl, customHeaders);
      }

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Content-Type': manifestContentType || (isMpd ? 'application/dash+xml' : 'application/vnd.apple.mpegurl'),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      return res.status(manifestStatus).send(content);
    }

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600'
    });
    if (response.headers['content-length']) res.set('Content-Length', response.headers['content-length']);
    if (response.headers['content-range']) res.set('Content-Range', response.headers['content-range']);
    if (response.headers['accept-ranges']) res.set('Accept-Ranges', response.headers['accept-ranges']);
    res.status(response.status);
    response.data.pipe(res);

    req.on('close', () => {
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
    });
  } catch (error) {
    console.error(`[Proxy] Error fetching ${targetUrl || req.params[0]}:`, error.message, error.response?.status);
    if (!res.headersSent) {
      res.status(502).send('Proxy Error: ' + error.message);
    }
  }
}

router.head('/*', handleProxyRequest);
router.get('/*', handleProxyRequest);

/**
 * Rewrite M3U8 playlist: chuyển mọi URL segment/key qua proxy
 */
function rewriteM3u8(content, baseUrl, proxyBase, origin, customHeaders) {
  const lines = content.split('\n');
  const result = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Rewrite URI="..." trong #EXT-X-KEY, #EXT-X-MAP
    if (trimmed.startsWith('#EXT-X-KEY:') || trimmed.startsWith('#EXT-X-MAP:') || trimmed.startsWith('#EXT-X-MEDIA:')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const absUri = resolveUrl(baseUrl, origin, uri);
        const rewritten = appendProxyHeaders(`${proxyBase}${absUri}`, customHeaders);
        return `URI="${rewritten}"`;
      });
    }

    // Giữ nguyên các comment/tag khác
    if (trimmed.startsWith('#')) return line;

    // Dòng URL (segment hoặc sub-playlist)
    const absUrl = resolveUrl(baseUrl, origin, trimmed);
    return appendProxyHeaders(proxyBase + absUrl, customHeaders);
  });
  return result.join('\n');
}

/**
 * Rewrite MPD manifest: chuyển mọi URL (BaseURL, SegmentTemplate, ...) qua proxy
 */
function rewriteMpd(content, baseUrl, proxyBase, origin, customHeaders) {
  const firstBaseUrl = (content.match(/<BaseURL>([^<]+)<\/BaseURL>/) || [])[1];
  const segmentBaseUrl = firstBaseUrl ? resolveAbsoluteUrl(baseUrl, origin, decodeXmlEntities(firstBaseUrl)) : baseUrl;

  // 1. Rewrite <BaseURL> tags
  content = content.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, decodeXmlEntities(url));
    return `<BaseURL>${escapeXmlText(appendProxyHeaders(proxyBase + absUrl, customHeaders))}</BaseURL>`;
  });

  // 2. Rewrite initialization="..." và media="..." trong SegmentTemplate
  content = content.replace(/initialization="([^"]+)"/g, (match, url) => {
    const decodedUrl = decodeXmlEntities(url);
    const base = (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://') || decodedUrl.startsWith('/')) ? baseUrl : segmentBaseUrl;
    const absUrl = resolveUrl(base, origin, decodedUrl);
    return `initialization="${escapeXmlAttribute(appendProxyHeaders(proxyBase + absUrl, customHeaders))}"`;
  });

  content = content.replace(/media="([^"]+)"/g, (match, url) => {
    // Chỉ rewrite nếu chứa dấu / (là path, không phải template variable thuần)
    const decodedUrl = decodeXmlEntities(url);
    if (decodedUrl.startsWith('$') && !decodedUrl.includes('/')) return match;
    const base = (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://') || decodedUrl.startsWith('/')) ? baseUrl : segmentBaseUrl;
    const absUrl = resolveUrl(base, origin, decodedUrl);
    return `media="${escapeXmlAttribute(appendProxyHeaders(proxyBase + absUrl, customHeaders))}"`;
  });

  // 3. Rewrite sourceURL="..." trong SegmentList
  content = content.replace(/sourceURL="([^"]+)"/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, decodeXmlEntities(url));
    return `sourceURL="${escapeXmlAttribute(appendProxyHeaders(proxyBase + absUrl, customHeaders))}"`;
  });

  content = content.replace(/\b((?:xlink:)?href)="([^"]+)"/g, (match, attr, url) => {
    if (!shouldRewriteXmlUrl(url)) return match;
    const absUrl = resolveUrl(baseUrl, origin, decodeXmlEntities(url));
    return `${attr}="${escapeXmlAttribute(appendProxyHeaders(proxyBase + absUrl, customHeaders))}"`;
  });

  return content;
}

/**
 * Giải quyết URL tương đối thành tuyệt đối và mã hóa nó
 */
function resolveUrl(baseUrl, origin, url) {
  let absUrl = resolveAbsoluteUrl(baseUrl, origin, url);
  
  // Mã hóa URL truyệt đối
  let encrypted;
  if (absUrl.includes('$')) {
    // Nếu URL chứa biến template của DASH, chỉ mã hóa phần thư mục gốc
    const lastSlash = absUrl.lastIndexOf('/');
    if (lastSlash > 8) { // Bỏ qua https://
      const basePath = absUrl.substring(0, lastSlash);
      const filePart = absUrl.substring(lastSlash + 1);
      if (basePath.includes('$')) return absUrl;
      encrypted = encryptUrl(basePath) + '/' + filePart;
    } else {
      encrypted = encryptUrl(absUrl);
    }
  } else {
    encrypted = encryptUrl(absUrl);
  }
  
  return encrypted || absUrl; // fallback nếu mã hóa lỗi
}

router._private = {
  rewriteMpd,
  resolveAbsoluteUrl,
  resolveUrl,
};

module.exports = router;
