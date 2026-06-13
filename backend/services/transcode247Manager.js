// 24/7 Transcode Manager for NhanChillTV (Low RAM Optimized)
const m3uManager = require('./m3uManager');
const ffmpegWrapper = require('../../ffmpeg-core/wrapper');
const Database = require('../db/database');
const config = require('../config');

class Transcode247Manager {
  constructor() {
    this.db = new Database(config.dbPath);
    this.timer = null;
    this.isChecking = false;
  }

  async start() {
    console.log('[24/7 Transcoder] Initializing 24/7 Transcoding Daemon...');
    // Dọn dẹp HLS cũ trước khi khởi động
    this.cleanupOldCache();

    // Chạy chu kỳ kiểm tra mỗi 15 giây để giữ luồng sống
    this.timer = setInterval(() => {
      this.checkAndMaintainStreams().catch(err => {
        console.error('[24/7 Transcoder] Maintenance loop error:', err.message);
      });
    }, 15000);

    // Chạy kiểm tra ngay lập tức khi khởi động
    setTimeout(() => {
      this.checkAndMaintainStreams().catch(err => {
        console.error('[24/7 Transcoder] Initial check error:', err.message);
      });
    }, 10000); // Trì hoãn 10 giây để m3uManager hoàn thành tải/dò
  }

  cleanupOldCache() {
    const fs = require('fs');
    const path = require('path');
    const settings = this.db.getIptvSettings();
    const list247 = settings.transcode247 || [];

    list247.forEach(channelId => {
      const outputDir = path.join(config.hlsTempPath, channelId);
      if (fs.existsSync(outputDir)) {
        try {
          fs.rmSync(outputDir, { recursive: true, force: true });
          console.log(`[24/7 Transcoder] Cleaned up HLS directory: ${channelId}`);
        } catch (e) {}
      }
    });
  }

  async checkAndMaintainStreams() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const settings = this.db.getIptvSettings();
      const list247 = settings.transcode247 || [];

      for (const channelId of list247) {
        const channel = m3uManager.getChannelById(channelId);
        if (!channel) {
          console.warn(`[24/7 Transcoder] Configured channel not found: ${channelId}`);
          continue;
        }

        // Kiểm tra xem tiến trình FFmpeg đã chạy chưa
        const isRunning = ffmpegWrapper.processes.has(channelId);
        if (!isRunning) {
          console.log(`[24/7 Transcoder] Starting 24/7 transcoding for channel: ${channel.name} (${channelId})`);
          try {
            await ffmpegWrapper.startTranscode(channelId, channel);
          } catch (err) {
            console.error(`[24/7 Transcoder] Failed to start transcode for ${channelId}:`, err.message);
          }
          // Delay 2 giây giữa các tiến trình khởi động để tránh vọt CPU
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Cập nhật lastAccess liên tục để tránh bị wrapper.js tự động dọn dẹp do timeout
          ffmpegWrapper.updateLastAccess(channelId);
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = new Transcode247Manager();
