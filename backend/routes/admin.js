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
    const imgPath = path.join(eventTempPath, `${id}.jpg`);
    fs.writeFileSync(imgPath, base64Data, 'base64');
    eventData.thumbnailUrl = `/event_temp/${id}.jpg?v=${Date.now()}`;
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
  const thumbnailPath = path.resolve(eventTempPath, `${eventId}.jpg`);
  if (path.dirname(thumbnailPath) === path.resolve(eventTempPath) && fs.existsSync(thumbnailPath)) {
    fs.rmSync(thumbnailPath, { force: true });
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

module.exports = router;
