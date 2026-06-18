const express = require('express');
const { homeAgentService, assertAuthorized } = require('../services/homeAgentService');
const moviesRouter = require('./movies');

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

router.post('/movie-cache', agentAuth, (req, res) => {
  try {
    const payload = req.body || {};
    const data = moviesRouter._cache?.ingest?.({
      requestPath: payload.requestPath || payload.path,
      query: payload.query || {},
      data: payload.data,
      provider: payload.provider || 'home-agent-kkphim',
      fetchedAt: payload.fetchedAt,
    });
    const status = homeAgentService.recordMovieCache({
      requestPath: payload.requestPath || payload.path,
      provider: payload.provider || 'home-agent-kkphim',
      entries: moviesRouter._cache?.getStatus?.()?.entries || 0,
      jobId: payload.jobId || null,
    });
    res.json({ success: true, data, status });
  } catch (err) {
    homeAgentService.recordMovieCache({ error: err.message });
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.get('/jobs', agentAuth, (req, res) => {
  try {
    const jobs = homeAgentService.leaseJobs(req.query.limit || 5);
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/jobs/:id/result', agentAuth, (req, res) => {
  try {
    const payload = req.body || {};
    let cacheResult = null;
    if (payload.success && payload.type === 'movie-fetch') {
      cacheResult = moviesRouter._cache?.ingest?.({
        requestPath: payload.requestPath,
        query: payload.query || {},
        data: payload.data,
        provider: payload.provider || 'home-agent-kkphim',
        fetchedAt: payload.fetchedAt,
      });
      homeAgentService.recordMovieCache({
        requestPath: payload.requestPath,
        provider: payload.provider || 'home-agent-kkphim',
        entries: moviesRouter._cache?.getStatus?.()?.entries || 0,
        jobId: req.params.id,
      });
    }
    const job = homeAgentService.completeJob(req.params.id, Boolean(payload.success), payload);
    res.json({ success: true, data: { job, cache: cacheResult } });
  } catch (err) {
    homeAgentService.completeJob(req.params.id, false, { error: err.message });
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.get('/backup', agentAuth, (req, res) => {
  try {
    const archive = homeAgentService.createBackupArchive();
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="nhanchill-backup-${Date.now()}.json.gz"`,
      'Cache-Control': 'no-store',
    });
    res.send(archive);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
