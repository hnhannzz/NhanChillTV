const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { encryptUrl, decryptUrl } = require('../utils/cryptoHelper');
const router = express.Router();

const httpKeepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 10000 });
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 10000 });

function getAbsoluteUrl(baseUrl, targetUrl) {
  try {
    return new URL(targetUrl, baseUrl).href;
  } catch (e) {
    return targetUrl;
  }
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
    const qs = req.originalUrl.split('?')[1];
    if (qs) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + qs;
    }

    if (!targetUrl.startsWith('http')) {
      return res.status(400).send('Invalid URL');
    }

    console.log('[Proxy] Fetching:', targetUrl);

    const controller = new AbortController();
    req.on('close', () => {
      controller.abort();
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
        'X-Requested-With': targetUrl.includes('fptplay') ? undefined : 'org.xbmc.kodi',
        'Origin': targetUrl.includes('fptplay') ? 'https://fptplay.vn' : undefined,
        'Referer': targetUrl.includes('fptplay') ? 'https://fptplay.vn/' : new URL(targetUrl).origin + '/'
      },
      responseType: 'stream',
      decompress: false,
      maxRedirects: 10,
      timeout: 30000,
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
        let content = Buffer.concat(chunks).toString('utf-8');
        
        // Sử dụng Relative Path (bắt đầu bằng /) để Browser tự động map đúng HTTPS và Host hiện tại (lách Cloudflare SSL issues)
        const proxyBase = `/api/proxy/`;
        const originOfFinalUrl = new URL(finalUrl).origin;

        if (isM3u8) {
          content = rewriteM3u8(content, finalUrl, proxyBase, originOfFinalUrl, customUa);
        } else if (isMpd) {
          content = rewriteMpd(content, finalUrl, proxyBase, originOfFinalUrl, customUa);
        }

        res.status(response.status).send(content);
      });
      response.data.on('error', (err) => {
        console.error('[Proxy] Stream read error:', err.message);
        if (!res.headersSent) res.status(502).send('Proxy stream error');
      });
    } else {
      // Pipe trực tiếp (segments .ts, .m4s, .mp4, .key, ...)
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
        let rewritten = `${proxyBase}${absUri}`;
        if (customUa) rewritten += (rewritten.includes('?') ? '&' : '?') + `ua=${encodeURIComponent(customUa)}`;
        return `URI="${rewritten}"`;
      });
    }

    // Giữ nguyên các comment/tag khác
    if (trimmed.startsWith('#')) return line;

    // Dòng URL (segment hoặc sub-playlist)
    const absUrl = resolveUrl(baseUrl, origin, trimmed);
    let rewritten = proxyBase + absUrl;
    if (customUa) rewritten += (rewritten.includes('?') ? '&' : '?') + `ua=${encodeURIComponent(customUa)}`;
    return rewritten;
  });
  return result.join('\n');
}

/**
 * Rewrite MPD manifest: chuyển mọi URL (BaseURL, SegmentTemplate, ...) qua proxy
 */
function rewriteMpd(content, baseUrl, proxyBase, origin, customUa) {
  const appendUa = (url) => customUa ? url + (url.includes('?') ? '&' : '?') + `ua=${encodeURIComponent(customUa)}` : url;

  // 0. Strip ContentProtection (DRM) elements - some providers include DRM headers
  //    for unencrypted content, causing JW Player error 232600
  content = content.replace(/<ContentProtection[^>]*>[\s\S]*?<\/ContentProtection>/g, '');

  // 1. Rewrite <BaseURL> tags
  content = content.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `<BaseURL>${appendUa(proxyBase + absUrl)}</BaseURL>`;
  });

  // 2. Rewrite initialization="..." và media="..." trong SegmentTemplate
  content = content.replace(/initialization="([^"]+)"/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `initialization="${appendUa(proxyBase + absUrl)}"`;
  });

  content = content.replace(/media="([^"]+)"/g, (match, url) => {
    if (url.startsWith('$') && !url.includes('/')) return match;
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `media="${appendUa(proxyBase + absUrl)}"`;
  });

  // 3. Rewrite sourceURL="..." trong SegmentList
  content = content.replace(/sourceURL="([^"]+)"/g, (match, url) => {
    const absUrl = resolveUrl(baseUrl, origin, url);
    return `sourceURL="${appendUa(proxyBase + absUrl)}"`;
  });

  // 4. Remove ContentProtection attributes from AdaptationSet and MPD
  content = content.replace(/ contentProtection="[^"]*"/g, '');

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
