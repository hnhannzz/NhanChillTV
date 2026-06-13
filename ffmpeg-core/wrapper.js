// FFmpeg Wrapper for NhanChillTV Beta v1.2
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../backend/config');

class FFmpegWrapper {
  constructor() {
    this.processes = new Map(); // channelId -> { pid, process, lastAccess }

    // Cleanup FFmpeg processes on Node.js exit to prevent zombies
    const cleanup = () => {
      for (const [channelId, session] of this.processes.entries()) {
        try {
          session.process.kill('SIGKILL');
        } catch (e) {}
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(); });
    process.on('SIGTERM', () => { cleanup(); process.exit(); });
  }

  checkFFmpegExists() {
    if (path.isAbsolute(config.ffmpegBin)) {
      return fs.existsSync(config.ffmpegBin);
    }
    return true;
  }

  async getStreamInfo(channelId, channelObj) {
    const udpUrl = channelObj.url;
    const userAgent = channelObj.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    return new Promise((resolve) => {
      // Fast timeout
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.warn(`[FFprobe] Timeout for ${channelId}, using fallback`);
          resolve({ videoCodec: 'h264', audioCodec: 'unknown', fieldOrder: 'progressive', fps: 25 });
        }
      }, 2000);

      const ffprobeExe = config.ffprobeBin;
      if (path.isAbsolute(ffprobeExe) && !fs.existsSync(ffprobeExe)) {
        clearTimeout(timeout);
        return resolve({ videoCodec: 'h264', audioCodec: 'unknown', fieldOrder: 'progressive', fps: 25 });
      }

      const args = [
        '-v', 'error',
        '-analyzeduration', '1000000',
        '-probesize', '1000000',
        '-user_agent', userAgent,
        '-show_entries', 'stream=codec_name,field_order,r_frame_rate',
        '-of', 'json',
        udpUrl
      ];

      const probe = spawn(ffprobeExe, args);
      let output = '';

      probe.stdout.on('data', (data) => output += data.toString());
      
      probe.on('close', (code) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);
        
        try {
          const json = JSON.parse(output);
          let vCodec = 'h264';
          let aCodec = 'aac';
          let fOrder = 'progressive';
          let fps = 25;
          
          if (json.streams) {
            for (const s of json.streams) {
              if (s.codec_name && ['h264', 'hevc', 'mpeg2video'].includes(s.codec_name)) {
                vCodec = s.codec_name;
                if (s.field_order && s.field_order !== 'progressive' && s.field_order !== 'unknown') {
                  fOrder = 'interlaced';
                }
                if (s.r_frame_rate) {
                  const parts = s.r_frame_rate.split('/');
                  fps = parts.length === 2 ? parseInt(parts[0]) / (parseInt(parts[1]) || 1) : parseInt(s.r_frame_rate);
                }
              } else if (s.codec_name && ['aac', 'mp2', 'mp3', 'ac3'].includes(s.codec_name)) {
                aCodec = s.codec_name;
              }
            }
          }
          console.log(`[FFprobe] ${channelId}: Video=${vCodec} (${fOrder}, ${fps}fps), Audio=${aCodec}`);
          resolve({ videoCodec: vCodec, audioCodec: aCodec, fieldOrder: fOrder, fps: fps });
        } catch (e) {
          console.warn(`[FFprobe] Parse error for ${channelId}, using fallback`);
          resolve({ videoCodec: 'h264', audioCodec: 'unknown', fieldOrder: 'progressive', fps: 25 });
        }
      });
    });
  }

  async startTranscode(channelId, channelObj) {
    const udpUrl = channelObj.url;
    const userAgent = channelObj.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    if (this.processes.has(channelId)) {
      this.updateLastAccess(channelId);
      const session = this.processes.get(channelId);
      return { status: 'existing', pid: session.pid, hlsFile: session.hlsFile };
    }

    const outputDir = path.join(config.hlsTempPath, channelId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const info = await this.getStreamInfo(channelId, channelObj);

    let args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-user_agent', userAgent,
      '-fflags', '+genpts+igndts+discardcorrupt',
    ];

    if (String(udpUrl).startsWith('udp://')) {
      args.push('-fifo_size', '150000', '-overrun_nonfatal', '1');
    }

    args.push('-i', udpUrl);

    // Phương án 2: Dùng copy (0% CPU, bỏ qua Deinterlace)
    args.push('-c:v', 'copy');

    // Audio processing
    if (info.audioCodec === 'aac') {
      args.push('-c:a', 'copy'); // Không cần encode lại nếu đã là AAC
    } else {
      args.push('-c:a', 'aac');
    }

    // HLS output
    args.push(
      '-f', 'hls',
      '-hls_time', '4', // Segment 4s for stability
      '-hls_list_size', '15',
      '-hls_flags', 'delete_segments',
      '-hls_segment_type', 'mpegts' // Use standard TS for max compatibility
    );

    let hlsFile = 'index.m3u8';
    let outputPath = path.join(outputDir, 'index.m3u8');

    args.push('-map', '0:v:0?');
    args.push('-map', '0:a:0?');
    args.push(outputPath);

    const ffmpeg = spawn(config.ffmpegBin, args, { cwd: outputDir });

    ffmpeg.on('error', (err) => {
      console.error(`[FFmpeg] Error for ${channelId}:`, err);
      this.processes.delete(channelId);
    });

    ffmpeg.on('exit', (code) => {
      console.log(`[FFmpeg] Exited for ${channelId} with code ${code}`);
      this.processes.delete(channelId);
    });

    this.processes.set(channelId, {
      pid: ffmpeg.pid,
      process: ffmpeg,
      lastAccess: Date.now(),
      hlsFile: hlsFile,
      outputPath: outputPath
    });

    return { status: 'started', pid: ffmpeg.pid, hlsFile };
  }

  stopTranscode(channelId) {
    const session = this.processes.get(channelId);
    if (session) {
      session.process.kill();
      this.processes.delete(channelId);

      try {
        const outputDir = path.dirname(session.outputPath);
        if (fs.existsSync(outputDir)) {
          console.log(`[Cleanup] Deleting HLS cache for ${channelId}`);
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(`[Cleanup] Failed to delete HLS cache for ${channelId}:`, err);
      }
      return true;
    }
    return false;
  }

  updateLastAccess(channelId) {
    const session = this.processes.get(channelId);
    if (session) {
      session.lastAccess = Date.now();
    }
  }

  cleanupInactive() {
    const now = Date.now();
    for (const [channelId, session] of this.processes.entries()) {
      if (now - session.lastAccess > config.streamTimeout) {
        console.log(`[Cleanup] Stopping inactive stream: ${channelId}`);
        this.stopTranscode(channelId);
      }
    }
  }

  getActiveStreams() {
    return Array.from(this.processes.entries()).map(([id, session]) => ({
      channelId: id,
      pid: session.pid,
      lastAccess: session.lastAccess
    }));
  }
}

module.exports = new FFmpegWrapper();
