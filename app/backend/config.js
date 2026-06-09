// NhanChillTV Beta v1.4 - Linux Configuration
const path = require('path');

const appRoot = process.env.NHANCHILL_APP_ROOT || path.resolve(__dirname, '..');
const parseBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
};
const parseIntEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  version: 'Beta v1.4',
  
  // Cluster Mode
  mode: process.env.MODE || 'STANDALONE', // 'STANDALONE', 'MASTER', 'WORKER'
  workers: [
    // { id: 'worker1', url: 'http://127.0.0.1:3001' }
  ],
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'change_me_before_deploy',
  tokenExpiresIn: '5m', // 5 phút

  // Server
  apiPort: parseIntEnv(process.env.PORT, 3000),
  nginxPort: parseIntEnv(process.env.NGINX_PORT, 80),
  
  // Paths
  appRoot,
  ffmpegBin: process.env.FFMPEG_BIN || 'ffmpeg',
  ffprobeBin: process.env.FFPROBE_BIN || 'ffprobe',
  m3uPath: process.env.M3U_PATH || path.join(appRoot, 'm3u_iptv/list.m3u'),
  hlsTempPath: process.env.HLS_TEMP_PATH || path.join(appRoot, 'temp/hls_temp'),
  eventTempPath: process.env.EVENT_TEMP_PATH || path.join(appRoot, 'temp/event_temp'),
  dbPath: path.join(__dirname, 'db/data.json'),
  
  // FFmpeg transcode settings
  ffmpeg: {
    preset: 'ultrafast',
    tune: 'zerolatency',
    hlsTime: 4,
    hlsListSize: 15,
    videoCodec: 'libx264',
    audioCodec: 'aac',
  },
  
  // Stream management
  directMode: parseBool(process.env.DIRECT_MODE, true), // Bypass FFmpeg and return M3U link directly
  streamTimeout: parseIntEnv(process.env.STREAM_TIMEOUT_MS, 120000), // 2 minutes
  cleanupInterval: parseIntEnv(process.env.CLEANUP_INTERVAL_MS, 60000), // 1 minute
  metricsInterval: parseIntEnv(process.env.METRICS_INTERVAL_MS, 5000),
  
  // Admin
  adminPassword: process.env.ADMIN_PASSWORD || 'change_me_before_deploy', // Change in production
};
