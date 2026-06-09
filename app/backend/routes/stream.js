// Stream Routes - NhanChillTV v1.4
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpegWrapper = require('../../ffmpeg-core/wrapper');
const m3uManager = require('../services/m3uManager');
const config = require('../config');
const authService = require('../services/authService');
const clusterService = require('../services/clusterService');
const { encryptUrl } = require('../utils/cryptoHelper');

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

    // Direct mode: bypass FFmpeg (skip for MPD+DRM which fails with JW Player error 232600)
    if (config.directMode && !channel.clearKey) {
      let isMpd = false;
      let encryptedUrl = null;

      // PRE-FETCH CHECK: Verify if the URL is actually MPD despite having m3u8 extension
      try {
        const headRes = await axios.get(channel.url, { 
          headers: { 
            'Range': 'bytes=0-1024',
            'User-Agent': channel.userAgent || 'Dalvik/2.1.0 (Linux; U; Android 10; TV Box Build/QQ3A.200805.001)',
            'X-Requested-With': 'org.xbmc.kodi'
          },
          timeout: 5000
        });
        
        const contentType = headRes.headers['content-type'] || '';
        const contentStr = (headRes.data || '').toString();
        
        if (contentType.includes('dash+xml') || contentStr.includes('<?xml') || contentStr.includes('<MPD')) {
          isMpd = true;
        }
      } catch (err) {
        console.warn(`[Stream] Pre-fetch check failed for ${channelId}:`, err.message);
      }

      encryptedUrl = encryptUrl(channel.url);

      // If encryption failed, fallback to plain
      let finalTarget = encryptedUrl ? `/api/proxy/${encryptedUrl}` : `/api/proxy/${channel.url}`;
      
      if (channel.userAgent) {
        const encodedUa = encodeURIComponent(channel.userAgent);
        finalTarget += finalTarget.includes('?') ? `&ua=${encodedUa}` : `?ua=${encodedUa}`;
      }

      return res.json({
        success: true,
        data: {
          status: 'direct',
          isDirect: true,
          hlsUrl: finalTarget,
          isMpd: isMpd,
          clearKey: null
        }
      });
    }

    // For MPD+DRM or non-direct mode: transcode to HLS via FFmpeg
    // This converts MPD/DASH to HLS (removing DRM dependency)
    const result = await ffmpegWrapper.startTranscode(channelId, channel);
    res.json({ 
      success: true, 
      data: {
        ...result,
        hlsUrl: `/hls/${auth.token}/${auth.expires}/${channelId}/${result.hlsFile}`,
        clearKey: channel.clearKey
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
