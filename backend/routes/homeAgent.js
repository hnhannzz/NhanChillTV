const express = require('express');
const { homeAgentService, assertAuthorized } = require('../services/homeAgentService');

const router = express.Router();

function agentAuth(req, res, next) {
  try {
    assertAuthorized(req);
    next();
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
}

router.post('/heartbeat', agentAuth, (req, res) => {
  try {
    const data = homeAgentService.recordHeartbeat(req.body || {}, req);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/epg', agentAuth, (req, res) => {
  try {
    const data = homeAgentService.ingestEpg(req.body || {}, req);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/channel-health', agentAuth, (req, res) => {
  try {
    const data = homeAgentService.recordChannelHealth(req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
