// Admin Routes - NhanChillTV Beta v1.2
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Database = require('../db/database');
const config = require('../config');
const pidusage = require('pidusage');
const { execFile } = require('child_process');
const ffmpegWrapper = require('../../ffmpeg-core/wrapper');
const m3uManager = require('../services/m3uManager');

const db = new Database(config.dbPath);

const eventTempPath = config.eventTempPath;
if (!fs.existsSync(eventTempPath)) {
  fs.mkdirSync(eventTempPath, { recursive: true });
}

// Simple auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (token === `Bearer ${config.adminPassword}`) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === config.adminPassword) {
    res.json({ success: true, token: config.adminPassword });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

function processEventPayload(data, id) {
  let eventData = { ...data };
  
  if (data.thumbnailBase64) {
    const base64Data = data.thumbnailBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgPath = path.join(eventTempPath, `${id}.jpg`);
    fs.writeFileSync(imgPath, base64Data, 'base64');
    eventData.thumbnailUrl = `/event_temp/${id}.jpg?v=${Date.now()}`;
  }
  delete eventData.thumbnailBase64;

  if (data.sourceType === 'obs') {
    const streamKey = data.streamKey || `event_${id}`;
    const hlsDir = path.join(config.hlsTempPath, streamKey);
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    eventData.stream = `/hls/${streamKey}/index.m3u8`;
    eventData.sourceChannelId = null;
  } else if (data.sourceType === 'iptv') {
    eventData.stream = null;
  } else if (data.sourceType === 'custom') {
    eventData.sourceChannelId = null;
  }
  
  return eventData;
}

// Events CRUD
router.get('/events', (req, res) => {
  res.json({ success: true, data: db.getEvents() });
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

router.put('/events/:id', auth, (req, res) => {
  const processedData = processEventPayload(req.body, req.params.id);
  const event = db.updateEvent(req.params.id, processedData);
  if (event) {
    res.json({ success: true, data: event });
  } else {
    res.status(404).json({ success: false, error: 'Event not found' });
  }
});

router.delete('/events/:id', auth, (req, res) => {
  db.deleteEvent(req.params.id);
  res.json({ success: true });
});

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
