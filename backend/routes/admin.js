// Admin Routes - NhanChillTV Beta v1.2
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const Database = require('../db/database');
const config = require('../config');
const pidusage = require('pidusage');
const si = require('systeminformation');
const { execFile } = require('child_process');
const ffmpegWrapper = require('../../ffmpeg-core/wrapper');
const m3uManager = require('../services/m3uManager');

const db = new Database(config.dbPath);
const adminSessions = new Set();

const eventTempPath = config.eventTempPath;
if (!fs.existsSync(eventTempPath)) {
  fs.mkdirSync(eventTempPath, { recursive: true });
}

// Simple auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  const sessionToken = String(token || '').replace(/^Bearer\s+/i, '');
  if (adminSessions.has(sessionToken)) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (db.verifyAdminPassword(password, config.adminPassword)) {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

router.post('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!db.verifyAdminPassword(currentPassword, config.adminPassword)) {
    return res.status(400).json({ success: false, error: 'Current password is incorrect' });
  }
  if (String(newPassword || '').length < 8) {
    return res.status(400).json({ success: false, error: 'New password must contain at least 8 characters' });
  }

  db.setAdminPassword(newPassword);
  adminSessions.clear();
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.add(token);
  return res.json({ success: true, token });
});

function processEventPayload(data, id) {
  const eventData = { ...data };
  
  if (data.thumbnailBase64) {
    const base64Data = data.thumbnailBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgPath = path.join(eventTempPath, `${id}.webp`);
    fs.writeFileSync(imgPath, base64Data, 'base64');
    eventData.thumbnailUrl = `/event_temp/${id}.webp?v=${Date.now()}`;
  }
  delete eventData.thumbnailBase64;

  eventData.startAt = data.startAt || data.time || null;
  eventData.endAt = data.endAt || null;
  eventData.time = eventData.startAt;

  const requestedStreams = Array.isArray(data.streams) && data.streams.length
    ? data.streams
    : [{
      id: 'primary',
      name: data.streamName || 'Luồng chính',
      sourceType: data.sourceType || 'iptv',
      sourceChannelId: data.sourceChannelId || null,
      stream: data.stream || null,
      streamKey: data.streamKey || null,
    }];

  eventData.streams = requestedStreams.map((source, index) => {
    const sourceType = ['obs', 'iptv', 'custom'].includes(source.sourceType) ? source.sourceType : 'iptv';
    const streamId = String(source.id || `stream_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const normalized = {
      id: streamId,
      name: String(source.name || `Luồng ${index + 1}`).trim(),
      sourceType,
      sourceChannelId: sourceType === 'iptv' ? source.sourceChannelId || null : null,
      stream: sourceType === 'custom' ? String(source.stream || '').trim() : null,
      streamKey: null,
    };

    if (sourceType === 'obs') {
      const requestedKey = String(source.streamKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
      normalized.streamKey = requestedKey || `event_${id}_${index + 1}_${crypto.randomBytes(3).toString('hex')}`;
      normalized.stream = `/hls/${normalized.streamKey}/index.m3u8`;
      fs.mkdirSync(path.join(config.hlsTempPath, normalized.streamKey), { recursive: true });
    }
    return normalized;
  });

  const primary = eventData.streams[0];
  eventData.sourceType = primary?.sourceType || 'iptv';
  eventData.sourceChannelId = primary?.sourceChannelId || null;
  eventData.stream = primary?.stream || null;
  eventData.streamKey = primary?.streamKey || null;
  eventData.status = getEventStatus(eventData);
  
  return eventData;
}

function getEventStatus(event, now = Date.now()) {
  const startValue = event.startAt || event.time;
  const start = startValue ? new Date(startValue).getTime() : 0;
  const end = event.endAt ? new Date(event.endAt).getTime() : 0;
  if (end && now >= end) return 'ended';
  if (start && now >= start) return 'live';
  if (start && now < start) return 'upcoming';
  return event.status || 'upcoming';
}

function getEventStreams(event) {
  if (Array.isArray(event.streams)) return event.streams;
  return event.sourceType === 'obs' ? [{ sourceType: 'obs', streamKey: event.streamKey }] : [];
}

async function disconnectRtmpPublisher(streamKey) {
  const name = encodeURIComponent(streamKey);
  await Promise.allSettled(['live', 'hls'].map(app => axios.get(
    `${config.rtmpControlUrl}/drop/publisher?app=${app}&name=${name}`,
    { timeout: 1500, validateStatus: status => status < 500 }
  )));
}

async function cleanupEventObsStreams(event) {
  const hlsRoot = path.resolve(config.hlsTempPath);
  for (const stream of getEventStreams(event)) {
    if (stream.sourceType !== 'obs' || !stream.streamKey) continue;
    const key = String(stream.streamKey).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!key) continue;
    const target = path.resolve(hlsRoot, key);
    if (path.dirname(target) !== hlsRoot) continue;
    await disconnectRtmpPublisher(key);
    try {
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      console.log(`[Event Cleanup] Removed OBS HLS data: ${key}`);
    } catch (err) {
      console.error(`[Event Cleanup] Failed for ${key}:`, err.message);
    }
  }
}

function cleanupEventThumbnail(event) {
  const eventId = String(event.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!eventId) return;
  const thumbnailPathJpg = path.resolve(eventTempPath, `${eventId}.jpg`);
  const thumbnailPathWebp = path.resolve(eventTempPath, `${eventId}.webp`);
  if (path.dirname(thumbnailPathJpg) === path.resolve(eventTempPath) && fs.existsSync(thumbnailPathJpg)) {
    fs.rmSync(thumbnailPathJpg, { force: true });
  }
  if (path.dirname(thumbnailPathWebp) === path.resolve(eventTempPath) && fs.existsSync(thumbnailPathWebp)) {
    fs.rmSync(thumbnailPathWebp, { force: true });
  }
}

async function cleanupEventArtifacts(event) {
  await cleanupEventObsStreams(event);
  cleanupEventThumbnail(event);
}

async function getEventsWithCurrentStatus() {
  const events = db.getEvents();
  let changed = false;
  const expired = [];
  const normalized = [];
  events.forEach(event => {
    const status = getEventStatus(event);
    if (status === 'ended') {
      expired.push(event);
      changed = true;
      return;
    }
    if (status !== event.status) {
      changed = true;
    }
    normalized.push(status === event.status ? event : { ...event, status });
  });
  if (changed) {
    const data = db.read();
    data.events = normalized;
    db.write(data);
  }
  await Promise.allSettled(expired.map(cleanupEventArtifacts));
  return normalized;
}

// Events CRUD
router.post('/events/validate-stream', (req, res) => {
  const streamKey = String(req.body?.name || req.query?.name || '').trim();
  const now = Date.now();
  const valid = streamKey && db.getEvents().some(event => {
    const end = event.endAt ? new Date(event.endAt).getTime() : 0;
    if (end && now >= end) return false;
    return getEventStreams(event).some(stream => stream.sourceType === 'obs' && stream.streamKey === streamKey);
  });
  return valid ? res.status(204).end() : res.status(403).end();
});

router.get('/events', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isAdmin = adminSessions.has(token);
  const currentEvents = await getEventsWithCurrentStatus();
  const events = currentEvents.map(event => isAdmin ? event : {
    ...event,
    streamKey: undefined,
    streams: event.streams?.map(stream => ({ ...stream, streamKey: undefined })),
  });
  res.json({ success: true, data: events });
});

router.post('/events', auth, (req, res) => {
  const tempId = Date.now().toString(); 
  const processedData = processEventPayload(req.body, tempId);
  processedData.id = tempId;
  
  const data = db.read();
  data.events.push(processedData);
  db.write(data);
  
  res.json({ success: true, data: processedData });
});

router.put('/events/:id', auth, async (req, res) => {
  const previousEvent = db.getEvents().find(item => item.id === req.params.id);
  const processedData = processEventPayload(req.body, req.params.id);
  if (previousEvent) {
    const retainedKeys = new Set(getEventStreams(processedData).map(stream => stream.streamKey).filter(Boolean));
    const removedStreams = getEventStreams(previousEvent).filter(stream => stream.streamKey && !retainedKeys.has(stream.streamKey));
    if (removedStreams.length) await cleanupEventObsStreams({ streams: removedStreams });
  }
  const event = db.updateEvent(req.params.id, processedData);
  if (event) {
    res.json({ success: true, data: event });
  } else {
    res.status(404).json({ success: false, error: 'Event not found' });
  }
});

router.delete('/events/:id', auth, async (req, res) => {
  const event = db.getEvents().find(item => item.id === req.params.id);
  db.deleteEvent(req.params.id);
  if (event) await cleanupEventArtifacts(event);
  res.json({ success: true });
});

const eventStatusTimer = setInterval(() => {
  getEventsWithCurrentStatus().catch(err => console.error('[Event Cleanup] Sweep failed:', err.message));
}, 10000);
eventStatusTimer.unref?.();
setImmediate(() => getEventsWithCurrentStatus().catch(err => console.error('[Event Cleanup] Initial sweep failed:', err.message)));

// M3U Sources Management
router.get('/m3u-sources', auth, (req, res) => {
  res.json({ success: true, data: db.getM3uSources() });
});

router.post('/m3u-sources', auth, (req, res) => {
  const source = {
    id: `src_${Date.now()}`,
    name: req.body.name || 'Nguồn Mới',
    type: req.body.type || 'url', // 'url' or 'file'
    url: req.body.url || '',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.addM3uSource(source);
  res.json({ success: true, data: source });
});

router.put('/m3u-sources/:id', auth, (req, res) => {
  const updates = {
    ...(req.body.name !== undefined ? { name: String(req.body.name).trim() } : {}),
    ...(req.body.type !== undefined ? { type: req.body.type } : {}),
    ...(req.body.url !== undefined ? { url: String(req.body.url).trim() } : {}),
    ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {})
  };
  const source = db.updateM3uSource(req.params.id, updates);
  if (!source) return res.status(404).json({ success: false, error: 'M3U source not found' });
  return res.json({ success: true, data: source });
});

router.delete('/m3u-sources/:id', auth, (req, res) => {
  db.deleteM3uSource(req.params.id);
  res.json({ success: true });
});

router.post('/m3u-sources/refresh', auth, async (req, res) => {
  const status = await m3uManager.refreshAll();
  res.json({ success: true, message: 'Refreshed successfully', data: status });
});

router.get('/status', auth, (req, res) => {
  res.json({ success: true, data: m3uManager.getStatus() });
});

// IPTV Settings
router.get('/iptv-settings', auth, (req, res) => {
  res.json({ success: true, data: db.getIptvSettings() });
});

router.post('/iptv-settings', auth, (req, res) => {
  const updated = db.updateIptvSettings(req.body);
  res.json({ success: true, data: updated });
});

router.post('/iptv-settings/transcode247/toggle', auth, (req, res) => {
  const { channelId } = req.body;
  if (!channelId) {
    return res.status(400).json({ success: false, error: 'Channel ID is required' });
  }

  const settings = db.getIptvSettings();
  if (!settings.transcode247) settings.transcode247 = [];

  const idx = settings.transcode247.indexOf(channelId);
  if (idx === -1) {
    settings.transcode247.push(channelId);
  } else {
    settings.transcode247.splice(idx, 1);
    // Khi tắt 24/7, dừng chuyển mã của kênh luôn
    ffmpegWrapper.stopTranscode(channelId);
  }

  db.updateIptvSettings(settings);

  // Gọi quản lý kiểm tra tức thời để khởi động/dừng luồng
  const transcode247Manager = require('../services/transcode247Manager');
  transcode247Manager.checkAndMaintainStreams().catch(() => {});

  res.json({ success: true, data: settings.transcode247 });
});

// System Settings
router.get('/system-settings', auth, (req, res) => {
  res.json({ success: true, data: db.getSystemSettings() });
});

router.post('/system-settings', auth, (req, res) => {
  const updated = db.updateSystemSettings(req.body);
  res.json({ success: true, data: updated });
});

router.get('/iptv-channels', auth, (req, res) => {
  res.json({ success: true, data: m3uManager.getChannels() });
});

function isM3u8Url(url) {
  return String(url || '').toLowerCase().includes('.m3u8');
}

function normalizeEmbedUrl(value) {
  const raw = String(value || '').trim();
  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : raw).trim();
}

router.get('/worldcup-streams', auth, (req, res) => {
  res.json({ success: true, data: db.getWorldCupSettings() });
});

router.post('/worldcup-streams/:matchId', auth, (req, res) => {
  const matchId = String(req.params.matchId || '').trim();
  const sourceType = ['iptv', 'custom'].includes(req.body?.sourceType) ? req.body.sourceType : 'iptv';
  const stream = {
    id: `wc_${Date.now()}`,
    name: String(req.body?.name || 'Luồng bổ sung').trim(),
    sourceType,
    sourceChannelId: sourceType === 'iptv' ? String(req.body?.sourceChannelId || '').trim() : null,
    stream: sourceType === 'custom' ? String(req.body?.stream || '').trim() : null,
  };

  if (!matchId) return res.status(400).json({ success: false, error: 'Match ID is required' });
  if (!stream.name) return res.status(400).json({ success: false, error: 'Stream name is required' });
  if (sourceType === 'iptv') {
    const channel = m3uManager.getChannelById(stream.sourceChannelId);
    if (!channel) return res.status(400).json({ success: false, error: 'IPTV channel not found' });
    if (!isM3u8Url(channel.url)) return res.status(400).json({ success: false, error: 'World Cup stream must be an M3U8 source' });
  }
  if (sourceType === 'custom' && !isM3u8Url(stream.stream)) {
    return res.status(400).json({ success: false, error: 'Custom stream must be an M3U8 URL' });
  }

  const added = db.addWorldCupStream(matchId, stream);
  res.json({ success: true, data: added });
});

router.delete('/worldcup-streams/:matchId/:streamId', auth, (req, res) => {
  db.deleteWorldCupStream(req.params.matchId, req.params.streamId);
  res.json({ success: true });
});

router.put('/worldcup-highlights/:matchId', auth, (req, res) => {
  const matchId = String(req.params.matchId || '').trim();
  const sourceType = ['embed', 'm3u8'].includes(req.body?.sourceType) ? req.body.sourceType : 'embed';
  const url = sourceType === 'embed' ? normalizeEmbedUrl(req.body?.url) : String(req.body?.url || '').trim();
  const title = String(req.body?.title || 'Highlight trận đấu').trim();

  if (!matchId) return res.status(400).json({ success: false, error: 'Match ID is required' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Highlight URL must start with http or https' });
  if (sourceType === 'm3u8' && !isM3u8Url(url)) {
    return res.status(400).json({ success: false, error: 'Highlight M3U8 must be an .m3u8 URL' });
  }

  const saved = db.setWorldCupHighlight(matchId, { sourceType, url, title });
  res.json({ success: true, data: saved });
});

router.delete('/worldcup-highlights/:matchId', auth, (req, res) => {
  db.deleteWorldCupHighlight(req.params.matchId);
  res.json({ success: true });
});

// Favorites
router.get('/favorites', (req, res) => {
  res.json({ success: true, data: db.getFavorites() });
});

router.post('/favorites/:channelId', (req, res) => {
  const favorites = db.toggleFavorite(req.params.channelId);
  res.json({ success: true, data: favorites });
});

// Active streams management
router.get('/active-streams', auth, (req, res) => {
  try {
    const hlsRoot = config.hlsTempPath;
    if (!fs.existsSync(hlsRoot)) {
      return res.json({ success: true, data: [] });
    }

    const items = fs.readdirSync(hlsRoot);
    const activeStreams = [];
    const now = Date.now();

    for (const name of items) {
      const folderPath = path.join(hlsRoot, name);
      try {
        const stat = fs.statSync(folderPath);
        if (!stat.isDirectory()) continue;

        const m3u8Path = path.join(folderPath, 'index.m3u8');
        if (fs.existsSync(m3u8Path)) {
          const fileStat = fs.statSync(m3u8Path);
          // If modified within the last 60 seconds, it's considered active
          const isPublishing = (now - fileStat.mtimeMs) < 60000;
          
          if (isPublishing) {
            let streamType = 'iptv';
            let displayName = `Kênh ${name}`;
            
            // Check if matches an event OBS stream
            const events = db.getEvents();
            const matchedEvent = events.find(event => 
              getEventStreams(event).some(stream => stream.streamKey === name)
            );
            
            if (matchedEvent) {
              streamType = 'obs';
              displayName = `Sự kiện: ${matchedEvent.title}`;
            } else {
              // Check if matches a known channel name
              const channels = m3uManager.getChannels() || [];
              const matchedChannel = channels.find(c => c.id === name);
              if (matchedChannel) {
                displayName = `Kênh IPTV: ${matchedChannel.name}`;
              }
            }

            activeStreams.push({
              id: name,
              name: displayName,
              type: streamType,
              lastActive: fileStat.mtime,
              pid: ffmpegWrapper.processes.get(name)?.pid || null
            });
          }
        }
      } catch (err) {}
    }

    res.json({ success: true, data: activeStreams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/active-streams/kill', auth, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Stream ID is required' });
  }

  try {
    // 1. Try to stop as IPTV FFmpeg stream
    ffmpegWrapper.stopTranscode(id);
    
    // 2. Try to disconnect as OBS stream
    await disconnectRtmpPublisher(id);
    
    // 3. Cleanup HLS folder
    const hlsRoot = path.resolve(config.hlsTempPath);
    const target = path.resolve(hlsRoot, id);
    if (path.dirname(target) === hlsRoot && fs.existsSync(target)) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
      } catch (e) {}
    }

    res.json({ success: true, message: `Stopped stream ${id}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System Controls
router.get('/system/status', (req, res) => {
  res.json({ success: true, data: db.getSystemSettings() });
});

router.post('/system/restart', auth, (req, res) => {
  res.json({ success: true, message: 'Server is reloading...' });
  const command = process.platform === 'win32' ? 'nginx.exe' : 'nginx';
  execFile(command, ['-s', 'reload'], (err) => {
    if (err) console.error('Nginx restart error:', err);
  });
  setTimeout(() => process.exit(1), 1000);
});

router.get('/system/metrics', auth, async (req, res) => {
  try {
    const streams = ffmpegWrapper.getActiveStreams();
    const pids = streams.map(s => s.pid);
    let stats = {};
    if (pids.length > 0) {
      stats = await pidusage(pids);
    }
    
    const result = streams.map(s => ({
      channelId: s.channelId,
      pid: s.pid,
      cpu: stats[s.pid] ? stats[s.pid].cpu : 0,
      memory: stats[s.pid] ? stats[s.pid].memory : 0,
      lastAccess: s.lastAccess
    }));
    
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getViewerStats(io) {
  if (!io?.sockets?.adapter) return { total: 0, rooms: [] };
  const socketIds = new Set(io.sockets.sockets.keys());
  const rooms = [];
  let total = 0;
  for (const [room, sockets] of io.sockets.adapter.rooms.entries()) {
    if (socketIds.has(room)) continue;
    const count = sockets.size || 0;
    total += count;
    rooms.push({ id: room, count });
  }
  rooms.sort((a, b) => b.count - a.count);
  return { total, rooms: rooms.slice(0, 12) };
}

router.get('/system/overview', auth, async (req, res) => {
  try {
    const [cpu, mem, disks, processes] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize().catch(() => []),
      si.processes().catch(() => ({ list: [] })),
    ]);
    const disk = (Array.isArray(disks) ? disks : []).find(item => item.mount === '/' || item.mount === 'C:') || disks?.[0] || null;
    const activeStreams = ffmpegWrapper.getActiveStreams();
    const ffmpegProcesses = (processes?.list || []).filter(item => /ffmpeg/i.test(`${item.name || ''} ${item.command || ''}`)).length;
    const io = req.app.get('io');
    const recentErrors = req.app.get('recentErrorLogs') || [];

    res.json({
      success: true,
      data: {
        cpu: {
          currentLoad: cpu.currentLoad,
        },
        memory: {
          free: mem.free,
          total: mem.total,
          used: mem.active,
          usedPercent: mem.total ? (mem.active / mem.total) * 100 : 0,
        },
        disk: disk ? {
          fs: disk.fs,
          mount: disk.mount,
          size: disk.size,
          used: disk.used,
          available: disk.available,
          usedPercent: disk.use,
        } : null,
        ffmpegProcesses: ffmpegProcesses || activeStreams.length,
        viewers: getViewerStats(io),
        recentErrors: recentErrors.slice(0, 5),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.adminSessions = adminSessions;
module.exports = router;
