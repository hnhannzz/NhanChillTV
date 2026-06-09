// IPTV Routes - NhanChillTV Beta v1.3
const express = require('express');
const router = express.Router();
const m3uManager = require('../services/m3uManager');
const Database = require('../db/database');
const config = require('../config');
const db = new Database(config.dbPath);

// Get all channels (with optional pagination and field selection)
router.get('/channels', (req, res) => {
  try {
    let channels = m3uManager.getChannels();
    const settings = db.getIptvSettings();
    
    // Filter hidden channels and groups
    channels = channels.filter(c => {
      if (settings.hiddenGroups && settings.hiddenGroups.includes(c.group)) return false;
      if (settings.hiddenChannels && settings.hiddenChannels.includes(c.id)) return false;
      return true;
    });

    if (settings.groupOrder && settings.groupOrder.length > 0) {
      channels.sort((a, b) => {
        const orderA = settings.groupOrder.indexOf(a.group);
        const orderB = settings.groupOrder.indexOf(b.group);
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        if (orderA !== -1) return -1;
        if (orderB !== -1) return 1;
        return 0;
      });
    }

    // Field selection (comma-separated, e.g. ?fields=id,name,group)
    if (req.query.fields) {
      const fields = req.query.fields.split(',').map(f => f.trim());
      channels = channels.map(ch => {
        const subset = {};
        fields.forEach(f => { if (ch[f] !== undefined) subset[f] = ch[f]; });
        return subset;
      });
    }

    // Pagination (e.g. ?page=1&limit=50)
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 0));
    const total = channels.length;
    let paginated = channels;
    if (limit > 0) {
      const start = (page - 1) * limit;
      paginated = channels.slice(start, start + limit);
    }

    res.json({
      success: true,
      data: paginated,
      pagination: limit > 0 ? { page, limit, total, totalPages: Math.ceil(total / limit) } : undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get channel by ID
router.get('/channels/:id', (req, res) => {
  try {
    const channel = m3uManager.getChannelById(req.params.id);
    if (channel) {
      res.json({ success: true, data: channel });
    } else {
      res.status(404).json({ success: false, error: 'Channel not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all groups
router.get('/groups', (req, res) => {
  try {
    const groups = m3uManager.getAllGroups();
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get channels by group
router.get('/groups/:group/channels', (req, res) => {
  try {
    const channels = m3uManager.getChannelsByGroup(req.params.group);
    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
