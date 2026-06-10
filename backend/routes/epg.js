const express = require('express');
const router = express.Router();
const epgService = require('../services/epgService');

// Get EPG for a specific channel ID
router.get('/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const epgData = epgService.getCurrentAndNext(channelId);
    
    res.json({
      success: true,
      data: epgData
    });
  } catch (err) {
    console.error('EPG route error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
