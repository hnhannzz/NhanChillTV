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
const { XMLParser } = require('fast-xml-parser');

const db = new Database(config.dbPath);
const adminSessions = new Set();
const rtmpStatParser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, trimValues: true });

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

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

async function getActiveRtmpPublishers() {
  try {
    const response = await axios.get(config.rtmpStatUrl, {
      timeout: 2000,
      responseType: 'text',
      validateStatus: status => status >= 200 && status < 300,
    });
    const parsed = rtmpStatParser.parse(response.data);
    const applications = asArray(parsed?.rtmp?.server)
      .flatMap(server => asArray(server?.application));
    const liveApplication = applications.find(application => application?.name === 'live');
    return asArray(liveApplication?.live?.stream).map(stream => ({
      id: String(stream?.name || ''),
      type: 'obs',
      online: true,
      uptimeMs: Number(stream?.time || 0),
      bitrateIn: Number(stream?.bw_in || 0),
      bytesIn: Number(stream?.bytes_in || 0),
      clients: Number(stream?.nclients || 0),
    })).filter(stream => stream.id);
  } catch (err) {
    console.warn('[RTMP Stat] Unavailable:', err.message);
    return [];
  }
}

async function getManagedStreams() {
  const rtmpPublishers = await getActiveRtmpPublishers();
  const rtmpByKey = new Map(rtmpPublishers.map(stream => [stream.id, stream]));
  const managedEventStreams = db.getEvents().flatMap(event => getEventStreams(event).map(stream => {
    const publisher = stream.streamKey ? rtmpByKey.get(stream.streamKey) : null;
    return {
      id: stream.streamKey || `${event.id}:${stream.id}`,
      type: stream.sourceType,
      name: stream.name || 'Luồng sự kiện',
      eventId: event.id,
      eventTitle: event.title,
      sourceChannelId: stream.sourceChannelId || null,
      url: stream.stream || null,
      online: stream.sourceType === 'obs' ? Boolean(publisher) : getEventStatus(event) === 'live',
      configured: true,
      ...(publisher || {}),
    };
  }));
  const managedObsKeys = new Set(managedEventStreams.filter(stream => stream.type === 'obs').map(stream => stream.id));
  const unmanagedPublishers = rtmpPublishers
    .filter(stream => !managedObsKeys.has(stream.id))
    .map(stream => ({ ...stream, name: stream.id, configured: false }));
  const ffmpegStreams = ffmpegWrapper.getActiveStreams().map(stream => ({
    id: stream.channelId,
    type: 'ffmpeg',
    name: stream.channelId,
    online: true,
    configured: true,
    pid: stream.pid,
    lastAccess: stream.lastAccess,
  }));
  return [...managedEventStreams, ...unmanagedPublishers, ...ffmpegStreams];
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

router.get('/streams/active', auth, async (req, res) => {
  const streams = await getManagedStreams();
  res.set('Cache-Control', 'no-store').json({ success: true, data: streams });
});

router.post('/streams/:type/:id/stop', auth, async (req, res) => {
  const type = String(req.params.type || '');
  const id = String(req.params.id || '');
  if (!/^[a-zA-Z0-9:_-]+$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid stream id' });
  }
  if (type === 'ffmpeg') {
    return res.json({ success: ffmpegWrapper.stopTranscode(id) });
  }
  if (type === 'obs') {
    await disconnectRtmpPublisher(id);
    return res.json({ success: true });
  }
  return res.status(400).json({ success: false, error: 'This stream type cannot be stopped from the server' });
});

// IPTV Settings
router.get('/iptv-settings', auth, (req, res) => {
  res.json({ success: true, data: db.getIptvSettings() });
});

router.post('/iptv-settings', auth, (req, res) => {
  const updated = db.updateIptvSettings(req.body);
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

// System Controls
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
