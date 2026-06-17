// NhanChillTV Beta v1.4 - Configuration
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultFfmpegBin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

module.exports = {
  version: 'Beta v1.4',
  
  // Cluster Mode
  mode: process.env.MODE || 'STANDALONE', // 'STANDALONE', 'MASTER', 'WORKER'
  workers: [
    // { id: 'worker1', url: 'http://127.0.0.1:3001' }
  ],
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'nhanchilltv_super_secret_key_1.4',
  tokenExpiresIn: '5m', // 5 phút

  // Server
  apiPort: process.env.PORT || 3000,
  nginxPort: Number(process.env.NGINX_PORT || 8050),
  
  // Paths
  projectRoot,
  ffmpegBin: process.env.FFMPEG_BIN || defaultFfmpegBin,
  ffprobeBin: process.env.FFPROBE_BIN || (process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'),
  m3uPath: process.env.M3U_PATH || path.join(projectRoot, 'nginx/m3u_iptv/list.m3u'),
  hlsTempPath: process.env.HLS_TEMP_PATH || path.join(projectRoot, 'nginx/temp/hls_temp'),
  eventTempPath: process.env.EVENT_TEMP_PATH || path.join(projectRoot, 'nginx/temp/event_temp'),
  epgCachePath: process.env.EPG_CACHE_PATH || path.join(projectRoot, 'nginx/temp/epg-cache.xml'),
  homeAgentStatePath: process.env.HOME_AGENT_STATE_PATH || path.join(projectRoot, 'nginx/temp/home-agent-state.json'),
  dbPath: process.env.DB_PATH || path.join(projectRoot, 'backend/db/data.json'),
  rtmpControlUrl: process.env.RTMP_CONTROL_URL || 'http://127.0.0.1:8050/rtmp-control',
  homeAgentToken: process.env.HOME_AGENT_TOKEN || '',
  
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
  directMode: process.env.DIRECT_MODE ? process.env.DIRECT_MODE !== 'false' : true,
  streamTimeout: Number(process.env.STREAM_TIMEOUT_MS || 120000),
  cleanupInterval: Number(process.env.CLEANUP_INTERVAL_MS || 60000),
  
  // Admin
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123', // Change in production
};
