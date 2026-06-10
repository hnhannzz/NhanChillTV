// IPTV Routes - NhanChillTV Beta v1.3
const express = require('express');
const router = express.Router();
const m3uManager = require('../services/m3uManager');
const Database = require('../db/database');
const config = require('../config');
const M3UParser = require('../controllers/m3u-parser');
const db = new Database(config.dbPath);

// Get all channels
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

    // We don't sort the channels array by groupOrder directly here because the frontend 
    // uses the channels array to extract unique groups. 
    // But we CAN sort the channels such that groups appear in the correct order.
    if (settings.groupOrder && settings.groupOrder.length > 0) {
      channels.sort((a, b) => {
        const orderA = settings.groupOrder.indexOf(a.group);
        const orderB = settings.groupOrder.indexOf(b.group);
        
        // If both groups are in the order list, sort by index
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        // If only A is in order list, it comes first
        if (orderA !== -1) return -1;
        // If only B is in order list, it comes first
        if (orderB !== -1) return 1;
        // Otherwise keep original order
        return 0;
      });
    }

    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get channel by ID
router.get('/channels/:id', (req, res) => {
  try {
    const channel = M3UParser.getChannelById(config.m3uPath, req.params.id);
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
    const groups = M3UParser.getAllGroups(config.m3uPath);
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get channels by group
router.get('/groups/:group/channels', (req, res) => {
  try {
    const channels = M3UParser.getChannelsByGroup(config.m3uPath, req.params.group);
    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
