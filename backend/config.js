// NhanChillTV Beta v1.4 - Configuration
const path = require('path');

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
  nginxPort: 8050,
  
  // Paths
  ffmpegBin: path.join(__dirname, '../ffmpeg-core/bin/ffmpeg.exe'),
  m3uPath: path.join(__dirname, '../nginx/m3u_iptv/list.m3u'),
  hlsTempPath: path.join(__dirname, '../nginx/temp/hls_temp'),
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
  directMode: true, // Bypass FFmpeg and return M3U link directly
  streamTimeout: 120000, // 2 minutes
  cleanupInterval: 60000, // 1 minute (check more often)
  
  // Admin
  adminPassword: 'admin123', // Change in production
};
