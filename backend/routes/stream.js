// Stream Routes - NhanChillTV v1.4
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ffmpegWrapper = require('../../ffmpeg-core/wrapper');
const m3uManager = require('../services/m3uManager');
const config = require('../config');
const authService = require('../services/authService');
const clusterService = require('../services/clusterService');
const { encryptUrl } = require('../utils/cryptoHelper');
const { detectChannelPlaybackType } = require('../services/streamTypeDetector');

function shouldProxyChannel(channel) {
  const searchable = [
    channel?.id,
    channel?.name,
    channel?.group,
    channel?.url
  ].map(value => String(value || '').toLowerCase()).join(' ');

  return searchable.includes('tv360') || searchable.includes('vtvcab');
}

function buildDirectProxyTarget(channel, playbackType = null) {
  if (!shouldProxyChannel(channel)) {
    return channel.url;
  }

  // Bỏ qua proxy cho các luồng FPT Play/VTV vì họ chặn IP Datacenter và có hỗ trợ CORS
  const encryptedUrl = encryptUrl(channel.url);
  let finalTarget = encryptedUrl ? `/api/proxy/${encryptedUrl}` : `/api/proxy/${channel.url}`;

  if (channel.userAgent) {
    const encodedUa = encodeURIComponent(channel.userAgent);
    finalTarget += finalTarget.includes('?') ? `&ua=${encodedUa}` : `?ua=${encodedUa}`;
  }

  if (channel.referer) {
    const encodedReferer = encodeURIComponent(channel.referer);
    finalTarget += finalTarget.includes('?') ? `&ref=${encodedReferer}` : `?ref=${encodedReferer}`;
  }

  if (channel.origin) {
    const encodedOrigin = encodeURIComponent(channel.origin);
    finalTarget += finalTarget.includes('?') ? `&origin=${encodedOrigin}` : `?origin=${encodedOrigin}`;
  }

  if (playbackType) {
    finalTarget += finalTarget.includes('?') ? `&pt=${encodeURIComponent(playbackType)}` : `?pt=${encodeURIComponent(playbackType)}`;
  }

  return finalTarget;
}

function buildForcedProxyTarget(channel, playbackType = null) {
  const encryptedUrl = encryptUrl(channel.url);
  let finalTarget = encryptedUrl ? `/api/proxy/${encryptedUrl}` : `/api/proxy/${channel.url}`;

  const appendParam = (key, value) => {
    if (!value) return;
    finalTarget += finalTarget.includes('?') ? `&${key}=${encodeURIComponent(value)}` : `?${key}=${encodeURIComponent(value)}`;
  };

  appendParam('ua', channel.userAgent);
  appendParam('ref', channel.referer);
  appendParam('origin', channel.origin);
  appendParam('pt', playbackType);

  return finalTarget;
}

function buildFallbackUrls(channel, playbackType, primaryUrl) {
  const fallbacks = [];
  const proxiedTarget = buildForcedProxyTarget(channel, playbackType);
  const isPrimaryProxy = String(primaryUrl || '').startsWith('/api/proxy/');
  const shouldOfferProxyFallback = playbackType === 'mpd' || Boolean(channel.clearKey);

  if (isPrimaryProxy && channel.url && channel.url !== primaryUrl) {
    fallbacks.push(channel.url);
  } else if (shouldOfferProxyFallback && proxiedTarget && proxiedTarget !== primaryUrl) {
    fallbacks.push(proxiedTarget);
  }

  return [...new Set(fallbacks.filter(Boolean))];
}

// Start stream
router.post('/start/:channelId', async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const channel = m3uManager.getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const clientIp = authService.getClientIp(req);
    const auth = authService.generateStreamToken(clientIp, channelId);

    // Xử lý Load Balancing nếu là MASTER
    if (config.mode === 'MASTER') {
      const worker = await clusterService.getBestWorker();
      if (worker) {
        return res.json({
          success: true,
          data: {
            status: 'redirected_to_worker',
            workerId: worker.id,
            hlsUrl: `${worker.url}/hls/${auth.token}/${auth.expires}/${channelId}/index.m3u8`
          }
        });
      }
    }

    // Direct mode: bypass FFmpeg. MPD/ClearKey must stay direct so Shaka can handle DRM.
    const playbackType = await detectChannelPlaybackType(channel);
    const isMpd = Boolean(playbackType.isMpd);
    const isHls = Boolean(playbackType.isHls);
    const isProgressive = Boolean(playbackType.isProgressive);

    let shouldGoDirect = config.directMode || isMpd || isHls || isProgressive;

    // Nếu là stream MPEG-TS (có vẻ là UDP/HTTP-TS) và không phải MPD, kiểm tra xem có cần transcode không
    if (shouldGoDirect && !isMpd && !isHls && !isProgressive) {
      const isMpegTs = playbackType.kind === 'mpegts' || playbackType.kind === 'unknown';
      if (isMpegTs) {
        try {
          const info = await ffmpegWrapper.getStreamInfo(channelId, channel);
          if (info.audioCodec === 'mp2' || info.audioCodec === 'mp3' || info.audioCodec === 'ac3' || info.audioCodec === 'unknown') {
            shouldGoDirect = false;
            console.log(`[Stream] Force transcoding for channel ${channelId} due to incompatible audio codec: ${info.audioCodec}`);
          }
        } catch (err) {
          console.warn(`[Stream] Probe failed for ${channelId}, forcing transcode:`, err.message);
          shouldGoDirect = false;
        }
      }
    }

    if (shouldGoDirect) {
      const manifestType = isMpd ? 'mpd' : isHls ? 'hls' : null;
      const finalTarget = buildDirectProxyTarget(channel, manifestType);
      const fallbackUrls = buildFallbackUrls(channel, manifestType, finalTarget);
      const clearKey = isMpd ? channel.clearKey : null;

      return res.json({
        success: true,
        data: {
          status: 'direct',
          isDirect: true,
          hlsUrl: finalTarget,
          proxyUrl: finalTarget,
          isMpd,
          isHls,
          streamType: playbackType.kind || (isMpd ? 'mpd' : isHls ? 'hls' : 'unknown'),
          detectionSource: playbackType.source || 'unknown',
          rawUrl: channel.url,
          userAgent: channel.userAgent || null,
          referer: channel.referer || null,
          origin: channel.origin || null,
          fallbackUrls,
          clearKey
        }
      });
    }

    // Nếu là STANDALONE hoặc WORKER, tự chạy FFmpeg
    const result = await ffmpegWrapper.startTranscode(channelId, channel);
    res.json({ 
      success: true, 
      data: {
        ...result,
        hlsUrl: `/hls/${auth.token}/${auth.expires}/${channelId}/${result.hlsFile}`,
        isMpd: false,
        isHls: true,
        streamType: 'hls',
        clearKey: null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Stop stream
router.post('/stop/:channelId', (req, res) => {
  try {
    const stopped = ffmpegWrapper.stopTranscode(req.params.channelId);
    res.json({ success: stopped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Heartbeat - update last access (dự phòng)
router.post('/heartbeat/:channelId', (req, res) => {
  ffmpegWrapper.updateLastAccess(req.params.channelId);
  res.json({ success: true });
});

// Get active streams
router.get('/active', (req, res) => {
  const streams = ffmpegWrapper.getActiveStreams();
  res.json({ success: true, data: streams });
});

// Stream status for smart loading
router.get('/status/:channelId', (req, res) => {
  const outputDir = path.join(config.hlsTempPath, req.params.channelId);
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      if (file.endsWith('.m3u8')) {
        const content = fs.readFileSync(path.join(outputDir, file), 'utf-8');
        if (content.includes('.ts') || content.includes('.m4s')) {
          return res.json({ success: true, ready: true });
        }
      }
    }
  }
  res.json({ success: true, ready: false });
});

module.exports = router;
