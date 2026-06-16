// Main Server - NhanChillTV v1.4
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const config = require('./config');
const ffmpegWrapper = require('../ffmpeg-core/wrapper');
const m3uManager = require('./services/m3uManager');
const transcode247Manager = require('./services/transcode247Manager');

const app = express();
const server = http.createServer(app);
server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 65000);
server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 70000);
server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 0);
server.timeout = Number(process.env.HTTP_SOCKET_TIMEOUT_MS || 0);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['DNT', 'User-Agent', 'X-Requested-With', 'If-Modified-Since', 'Cache-Control', 'Content-Type', 'Range', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Range']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/iptv', require('./routes/iptv'));
app.use('/api/stream', require('./routes/stream'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));
app.use('/api/comments', require('./routes/comment'));
app.use('/api/epg', require('./routes/epg'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/proxy', require('./routes/proxy'));
app.use('/api/worldcup', require('./routes/worldcup'));

// Health check & Metrics for Load Balancing
app.get('/api/health', async (req, res) => {
  try {
    const cpuLoad = await si.currentLoad();
    const mem = await si.mem();
    
    res.json({ 
      success: true, 
      version: config.version,
      mode: config.mode,
      ffmpegAvailable: ffmpegWrapper.checkFFmpegExists(),
      cpuLoad: {
        currentLoad: cpuLoad.currentLoad
      },
      memory: {
        free: mem.available || mem.free,
        total: mem.total
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Cleanup inactive streams
setInterval(() => {
  ffmpegWrapper.cleanupInactive();
}, config.cleanupInterval);

// Realtime Metrics via Socket.IO
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Track viewers per channel
  socket.on('join_channel', (channelId) => {
    // Leave previous channels if any
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });
    
    if (channelId) {
      socket.join(channelId);
      const viewers = io.sockets.adapter.rooms.get(channelId)?.size || 0;
      io.to(channelId).emit('viewer_count', { channelId, count: viewers });
    }
  });

  socket.on('leave_channel', (channelId) => {
    socket.leave(channelId);
    const viewers = io.sockets.adapter.rooms.get(channelId)?.size || 0;
    io.to(channelId).emit('viewer_count', { channelId, count: viewers });
  });

  socket.on('disconnecting', () => {
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        const viewers = (io.sockets.adapter.rooms.get(room)?.size || 1) - 1;
        io.to(room).emit('viewer_count', { channelId: room, count: viewers });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

setInterval(async () => {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const netStats = await si.networkStats();
    
    let rx = 0;
    let tx = 0;
    if (netStats && netStats.length > 0) {
      rx = netStats[0].rx_sec / (1024 * 1024); // MB/s
      tx = netStats[0].tx_sec / (1024 * 1024); // MB/s
    }

    const freeMem = mem.available || mem.free;
    const usedMemPct = (((mem.total - freeMem) / mem.total) * 100).toFixed(2);

    const metrics = {
      cpu: cpu.currentLoad.toFixed(2),
      memoryUsed: usedMemPct,
      memoryFree: freeMem,
      memoryTotal: mem.total,
      networkRx: rx.toFixed(2),
      networkTx: tx.toFixed(2),
      activeStreams: ffmpegWrapper.getActiveStreams().length
    };
    
    io.emit('system_metrics', metrics);
  } catch (err) {
    console.error('[Metrics] Error gathering system info:', err);
  }
}, 2000);

// Start server
m3uManager.refreshAll().then(() => {
  m3uManager.startAutoRefresh(Number(process.env.M3U_REFRESH_INTERVAL_MS || 60 * 60 * 1000));
  
  // Khởi động trình quản lý transcode 24/7
  transcode247Manager.start();

  server.listen(config.apiPort, () => {
    console.log(`[Server] NhanChillTV ${config.version} running in ${config.mode} mode on port ${config.apiPort}`);
    console.log(`[FFmpeg] Binary check: ${ffmpegWrapper.checkFFmpegExists()}`);
  });
});
