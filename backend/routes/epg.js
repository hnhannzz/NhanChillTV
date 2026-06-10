const express = require('express');
const router = express.Router();
const epgService = require('../services/epgService');

// Get EPG for a specific channel ID
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    await epgService.ensureData();
    const epgData = epgService.getCurrentAndNext(channelId, {
      name: req.query.name,
      limit: req.query.limit,
    });
    
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
