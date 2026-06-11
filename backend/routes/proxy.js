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

const INTERNAL_QUERY_PARAMS = new Set(['ua']);

function appendForwardedQuery(targetUrl, req) {
  const params = new URLSearchParams(req.query);
  for (const key of INTERNAL_QUERY_PARAMS) {
    params.delete(key);
  }

  const query = params.toString();
  if (!query) return targetUrl;
  return targetUrl + (targetUrl.includes('?') ? '&' : '?') + query;
}

function appendProxyUa(url, customUa) {
  if (!customUa) return url;
  return url + (url.includes('?') ? '&' : '?') + `ua=${encodeURIComponent(customUa)}`;
}

function decodeManifestBuffer(buffer, encoding) {
  const normalized = String(encoding || '').toLowerCase();
  if (normalized.includes('gzip')) return zlib.gunzipSync(buffer);
  if (normalized.includes('br')) return zlib.brotliDecompressSync(buffer);
  if (normalized.includes('deflate')) return zlib.inflateSync(buffer);
  return buffer;
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

  return res.json({ success: true, url: proxiedUrl });
});

router.get('/*', async (req, res) => {
  try {
    let targetUrl = req.params[0];
    
    // Fix dấu // bị mất do Express normalize
    targetUrl = targetUrl.replace(/^(https?):\/+/, '$1://');

    // Cố gắng giải mã nếu URL không bắt đầu bằng http
    if (!targetUrl.startsWith('http')) {
      const parts = targetUrl.split('/');
      if (parts.length > 1) {
        // Trường hợp URL chứa template variables (ENCRYPTED_BASE/file_part)
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

    // Kế thừa query parameters
    targetUrl = appendForwardedQuery(targetUrl, req);

    if (!targetUrl.startsWith('http')) {
      return res.status(400).send('Invalid URL');
    }

    if (PROXY_LOG_REQUESTS) {
      console.log('[Proxy] Fetching:', targetUrl);
    }

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const customUa = req.query.ua;

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      signal: controller.signal,
      httpAgent: httpKeepAliveAgent,
      httpsAgent: httpsKeepAliveAgent,
      headers: {
        'User-Agent': customUa ? customUa : (targetUrl.includes('fptplay') 
                      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
                      : (req.headers['user-agent']?.includes('Mozilla') ? 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)' : (req.headers['user-agent'] || 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)'))),
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'X-Requested-With': targetUrl.includes('fptplay') ? undefined : 'org.xbmc.kodi',
        'Origin': targetUrl.includes('fptplay') ? 'https://fptplay.vn' : undefined,
        'Referer': targetUrl.includes('fptplay') ? 'https://fptplay.vn/' : new URL(targetUrl).origin + '/',
        'Range': req.headers.range
      },
      responseType: 'stream',
      decompress: false,
      maxRedirects: 10,
      timeout: PROXY_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true
    });

    const contentType = response.headers['content-type'] || '';
    const finalUrl = response.request.res.responseUrl || targetUrl;

    // Xác định loại file
    const lowerUrl = targetUrl.toLowerCase();
    const isM3u8 = lowerUrl.includes('.m3u8') || contentType.includes('mpegurl');
    const isMpd = lowerUrl.includes('.mpd') || contentType.includes('dash+xml');
    const isManifest = isM3u8 || isMpd;

    // CORS and Cache headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
      'Content-Type': contentType || (isMpd ? 'application/dash+xml' : isM3u8 ? 'application/vnd.apple.mpegurl' : 'application/octet-stream'),
      'Cache-Control': isManifest ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });

    if (isManifest) {
      // Buffer manifest để rewrite URLs
      const chunks = [];
      response.data.on('data', chunk => chunks.push(chunk));
      response.data.on('end', () => {
        try {
        const decoded = decodeManifestBuffer(Buffer.concat(chunks), response.headers['content-encoding']);
        let content = decoded.toString('utf-8');
        
        // Sử dụng Relative Path (bắt đầu bằng /) để Browser tự động map đúng HTTPS và Host hiện tại (lách Cloudflare SSL issues)
        const proxyBase = `/api/proxy/`;
        const originOfFinalUrl = new URL(finalUrl).origin;

        if (isM3u8) {
          content = rewriteM3u8(content, finalUrl, proxyBase, originOfFinalUrl, customUa);
        } else if (isMpd) {
          content = rewriteMpd(content, finalUrl, proxyBase, originOfFinalUrl, customUa);
        }

        res.status(response.status).send(content);
        } catch (err) {
          console.error('[Proxy] Manifest rewrite error:', err.message);
          if (!res.headersSent) res.status(502).send('Proxy manifest error');
        }
      });
      response.data.on('error', (err) => {
        console.error('[Proxy] Stream read error:', err.message);
        if (!res.headersSent) res.status(502).send('Proxy stream error');
      });
    } else {
      // Pipe trực tiếp (segments .ts, .m4s, .mp4, .key, ...)
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
    }

  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    if (!res.headersSent) {
      res.status(502).send('Proxy Error: ' + error.message);
    }
  }
});

/**
 * Rewrite M3U8 playlist: chuyển mọi URL segment/key qua proxy
 */
function rewriteM3u8(content, baseUrl, proxyBase, origin, customUa) {
  const lines = content.split('\n');
  const result = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Rewrite URI="..." trong #EXT-X-KEY, #EXT-X-MAP
    if (trimmed.startsWith('#EXT-X-KEY:') || trimmed.startsWith('#EXT-X-MAP:') || trimmed.startsWith('#EXT-X-MEDIA:')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const absUri = resolveUrl(baseUrl, origin, uri);
        const rewritten = appendProxyUa(`${proxyBase}${absUri}`, customUa);
        return `URI="${rewritten}"`;
      });
    }

    // Giữ nguyên các comment/tag khác
    if (trimmed.startsWith('#')) return line;

    // Dòng URL (segment hoặc sub-playlist)
    const absUrl = resolveUrl(baseUrl, origin, trimmed);
    return appendProxyUa(proxyBase + absUrl, customUa);
  });
  return result.join('\n');
}

/**
 * Rewrite MPD manifest: chuyển mọi URL (BaseURL, SegmentTemplate, ...) qua proxy
 */
function rewriteMpd(content, baseUrl, proxyBase, origin, customUa) {
  // 1. Rewrite <BaseURL> tags
  content = content.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `<BaseURL>${appendProxyUa(proxyBase + absUrl, customUa)}</BaseURL>`;
  });

  // 2. Rewrite initialization="..." và media="..." trong SegmentTemplate
  content = content.replace(/initialization="([^"]+)"/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `initialization="${appendProxyUa(proxyBase + absUrl, customUa)}"`;
  });

  content = content.replace(/media="([^"]+)"/g, (match, url) => {
    // Chỉ rewrite nếu chứa dấu / (là path, không phải template variable thuần)
    if (url.startsWith('$') && !url.includes('/')) return match;
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `media="${appendProxyUa(proxyBase + absUrl, customUa)}"`;
  });

  // 3. Rewrite sourceURL="..." trong SegmentList
  content = content.replace(/sourceURL="([^"]+)"/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `sourceURL="${appendProxyUa(proxyBase + absUrl, customUa)}"`;
  });

  return content;
}

/**
 * Giải quyết URL tương đối thành tuyệt đối và mã hóa nó
 */
function resolveUrl(baseUrl, origin, url) {
  let absUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.startsWith('/')) {
      absUrl = origin + url;
    } else {
      try {
        absUrl = new URL(url, baseUrl).href;
      } catch (e) {
        absUrl = origin + '/' + url;
      }
    }
  }
  
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

module.exports = router;
