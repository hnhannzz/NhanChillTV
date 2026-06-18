const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const config = require('../config');
const epgService = require('./epgService');

const DEFAULT_STATE = {
  agent: null,
  epg: null,
  channelHealth: {
    updatedAt: null,
    total: 0,
    ok: 0,
    failed: 0,
    byType: {},
    channels: [],
  },
  relay: {
    enabled: false,
    updatedAt: null,
  },
  backup: {
    lastPulledAt: null,
    bytes: 0,
  },
  movieCache: {
    updatedAt: null,
    entries: 0,
    lastJobAt: null,
    lastError: null,
  },
  jobs: [],
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    console.warn('[HomeAgent] Failed to read state:', err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers['x-home-agent-token'] || '').trim();
}

function assertAuthorized(req) {
  if (!config.homeAgentToken) {
    const err = new Error('HOME_AGENT_TOKEN is not configured on the main server');
    err.statusCode = 503;
    throw err;
  }
  if (!safeEqual(getBearerToken(req), config.homeAgentToken)) {
    const err = new Error('Unauthorized home agent');
    err.statusCode = 401;
    throw err;
  }
}

class HomeAgentService {
  constructor() {
    this.statePath = config.homeAgentStatePath;
    this.state = readJson(this.statePath, DEFAULT_STATE);
  }

  save() {
    writeJson(this.statePath, this.state);
  }

  getStatus() {
    const now = Date.now();
    const lastSeen = this.state.agent?.lastSeenAt ? new Date(this.state.agent.lastSeenAt).getTime() : 0;
    const online = lastSeen > 0 && now - lastSeen < Number(process.env.HOME_AGENT_ONLINE_WINDOW_MS || 3 * 60 * 1000);
    const epgStatus = epgService.getStatus();
    return {
      tokenConfigured: Boolean(config.homeAgentToken),
      online,
      fallbackMode: !online,
      fallbackReason: online ? null : 'Home Agent offline, main VPS keeps serving disk/API cache',
      statePath: this.statePath,
      ...this.state,
      epgService: epgStatus,
    };
  }

  recordHeartbeat(payload = {}, req) {
    this.state.agent = {
      id: String(payload.id || payload.hostname || 'home-agent'),
      hostname: String(payload.hostname || ''),
      version: String(payload.version || ''),
      ip: req.ip,
      lastSeenAt: new Date().toISOString(),
      uptimeSeconds: Number(payload.uptimeSeconds || 0),
      metrics: payload.metrics || {},
      network: payload.network || {},
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities.slice(0, 20) : [],
    };
    this.save();
    return this.state.agent;
  }

  ingestEpg(payload = {}, req) {
    let xml = String(payload.xml || '');
    if (!xml && payload.gzipBase64) {
      const compressed = Buffer.from(String(payload.gzipBase64 || ''), 'base64');
      xml = zlib.gunzipSync(compressed).toString('utf8');
    }
    if (!/^\s*<\?xml|^\s*<tv[\s>]/i.test(xml)) {
      const err = new Error('Invalid XMLTV payload');
      err.statusCode = 400;
      throw err;
    }

    const source = String(payload.source || 'home-agent');
    const parsed = epgService.ingestXml(xml, source);
    this.state.epg = {
      updatedAt: new Date().toISOString(),
      fetchedAt: payload.fetchedAt || null,
      source,
      bytes: Number(payload.bytes || Buffer.byteLength(xml)),
      gzipBytes: Number(payload.gzipBytes || 0),
      durationMs: Number(payload.durationMs || 0),
      statusCode: Number(payload.statusCode || 0),
      channels: parsed.channels,
      schedules: parsed.schedules,
      agentIp: req.ip,
    };
    this.save();
    return this.state.epg;
  }

  recordChannelHealth(payload = {}) {
    const channels = Array.isArray(payload.channels) ? payload.channels.slice(0, 500) : [];
    const byType = {};
    let ok = 0;
    channels.forEach(channel => {
      const type = String(channel.type || 'unknown');
      byType[type] = (byType[type] || 0) + 1;
      if (channel.ok) ok += 1;
    });
    this.state.channelHealth = {
      updatedAt: new Date().toISOString(),
      durationMs: Number(payload.durationMs || 0),
      total: channels.length,
      ok,
      failed: Math.max(0, channels.length - ok),
      byType,
      channels,
    };
    this.save();
    return this.state.channelHealth;
  }

  recordMovieCache(payload = {}) {
    this.state.movieCache = {
      ...(this.state.movieCache || {}),
      updatedAt: new Date().toISOString(),
      entries: Number(payload.entries ?? this.state.movieCache?.entries ?? 0),
      lastPath: payload.path || payload.requestPath || this.state.movieCache?.lastPath || null,
      lastProvider: payload.provider || this.state.movieCache?.lastProvider || null,
      lastJobAt: payload.jobId ? new Date().toISOString() : this.state.movieCache?.lastJobAt || null,
      lastError: payload.error || null,
    };
    this.save();
    return this.state.movieCache;
  }

  enqueueMovieFetch(requestPath, query = {}, reason = 'refresh', priority = 5) {
    const pathKey = String(requestPath || '/popular');
    const cleanQuery = Object.fromEntries(
      Object.entries(query || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    );
    const key = `movie:${pathKey}?${new URLSearchParams(cleanQuery).toString()}`;
    const now = new Date().toISOString();
    this.state.jobs = Array.isArray(this.state.jobs) ? this.state.jobs : [];

    const existing = this.state.jobs.find(job => job.key === key && ['queued', 'leased'].includes(job.status));
    if (existing) {
      existing.priority = Math.min(Number(existing.priority || priority), Number(priority || 5));
      existing.updatedAt = now;
      existing.reason = reason;
      this.save();
      return existing;
    }

    const job = {
      id: `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      key,
      type: 'movie-fetch',
      status: 'queued',
      priority: Number(priority || 5),
      requestPath: pathKey,
      query: cleanQuery,
      reason,
      createdAt: now,
      updatedAt: now,
      leasedAt: null,
      attempts: 0,
    };
    this.state.jobs.push(job);
    this.pruneJobs();
    this.save();
    return job;
  }

  leaseJobs(maxJobs = 5) {
    const nowMs = Date.now();
    const leaseMs = Number(process.env.HOME_AGENT_JOB_LEASE_MS || 2 * 60 * 1000);
    this.state.jobs = Array.isArray(this.state.jobs) ? this.state.jobs : [];
    const jobs = this.state.jobs
      .filter(job => {
        if (job.status === 'queued') return true;
        if (job.status !== 'leased') return false;
        const leasedAt = job.leasedAt ? new Date(job.leasedAt).getTime() : 0;
        return !leasedAt || nowMs - leasedAt > leaseMs;
      })
      .sort((a, b) => Number(a.priority || 5) - Number(b.priority || 5) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(20, Number(maxJobs || 5))));

    const now = new Date().toISOString();
    jobs.forEach(job => {
      job.status = 'leased';
      job.leasedAt = now;
      job.updatedAt = now;
      job.attempts = Number(job.attempts || 0) + 1;
    });
    if (jobs.length) this.save();
    return jobs;
  }

  completeJob(jobId, ok, result = {}) {
    this.state.jobs = Array.isArray(this.state.jobs) ? this.state.jobs : [];
    const job = this.state.jobs.find(item => item.id === jobId);
    if (!job) return null;
    job.status = ok ? 'done' : 'failed';
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
    job.error = ok ? null : String(result.error || 'unknown error').slice(0, 240);
    if (!ok && Number(job.attempts || 0) < Number(process.env.HOME_AGENT_JOB_MAX_ATTEMPTS || 3)) {
      job.status = 'queued';
      job.leasedAt = null;
    }
    this.pruneJobs();
    this.save();
    return job;
  }

  pruneJobs() {
    const keep = Number(process.env.HOME_AGENT_JOB_HISTORY || 60);
    const active = this.state.jobs.filter(job => ['queued', 'leased'].includes(job.status));
    const history = this.state.jobs
      .filter(job => !['queued', 'leased'].includes(job.status))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, keep);
    this.state.jobs = [...active, ...history];
  }

  createBackupArchive() {
    const candidates = [
      path.join(config.projectRoot, 'backend/db/data.json'),
      path.join(config.projectRoot, 'backend/db/users.json'),
      path.join(config.projectRoot, 'backend/db/comments.json'),
      path.join(config.projectRoot, 'nginx/temp/worldcup-cache.json'),
      config.homeAgentStatePath,
    ];
    const files = {};
    for (const filePath of candidates) {
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(config.projectRoot) || !fs.existsSync(resolved)) continue;
      const rel = path.relative(config.projectRoot, resolved).replace(/\\/g, '/');
      try {
        const stat = fs.statSync(resolved);
        if (!stat.isFile() || stat.size > Number(process.env.HOME_AGENT_BACKUP_MAX_FILE_BYTES || 5 * 1024 * 1024)) continue;
        files[rel] = {
          mtime: stat.mtime.toISOString(),
          bytes: stat.size,
          content: fs.readFileSync(resolved, 'utf8'),
        };
      } catch (err) {
        console.warn('[HomeAgent] Backup read failed:', rel, err.message);
      }
    }

    const payload = {
      createdAt: new Date().toISOString(),
      version: config.version,
      files,
    };
    const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload, null, 2), 'utf8'), { level: 6 });
    this.state.backup = {
      lastPulledAt: payload.createdAt,
      bytes: buffer.length,
      fileCount: Object.keys(files).length,
    };
    this.save();
    return buffer;
  }
}

module.exports = {
  homeAgentService: new HomeAgentService(),
  assertAuthorized,
};
