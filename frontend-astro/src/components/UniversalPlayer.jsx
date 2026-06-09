import React, { useEffect, useRef, useState } from 'react';
import dashjs from 'dashjs';
import Hls from 'hls.js';

export default function UniversalPlayer({ url, clearKey, style }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const isMpd = url.toLowerCase().includes('.mpd');
    const isM3u8 = url.toLowerCase().includes('.m3u8');

    // Hủy player cũ nếu có
    if (playerRef.current) {
      if (playerRef.current.destroy) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
    }

    if (isMpd) {
      // Khởi tạo Dash.js theo chuẩn Reference
      const player = dashjs.MediaPlayer().create();
      playerRef.current = player;
      
      // Tối ưu hoá mạng cho Proxy
      player.updateSettings({
        streaming: {
          retryIntervals: {
            MPD: 2000,
            MediaSegment: 1000
          },
          retryAttempts: {
            MPD: 5,
            MediaSegment: 5
          }
        }
      });

      player.initialize(video, url, true);

      // Nhúng DRM ClearKey
      if (clearKey && Object.keys(clearKey).length > 0) {
        const protData = {
          "org.w3.clearkey": {
            "clearkeys": clearKey
          }
        };
        player.setProtectionData(protData);
      }

    } else if (isM3u8) {
      // Khởi tạo HLS.js
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxLoadingDelay: 4,
          minAutoBitrate: 0,
          lowLatencyMode: true,
        });
        playerRef.current = hls;
        
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Autoplay blocked:', e));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Fallback cho Safari
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay blocked:', e));
        });
      }
    } else {
      // Fallback mặc định
      video.src = url;
      video.play().catch(e => console.log('Autoplay blocked:', e));
    }

    return () => {
      if (playerRef.current) {
        if (playerRef.current.destroy) {
          playerRef.current.destroy();
        } else if (playerRef.current.reset) {
          playerRef.current.reset();
        }
      }
    };
  }, [url, clearKey]);

  return (
    <div style={{ ...style, position: 'relative', backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        controls
        style={{ width: '100%', height: '100%' }}
        crossOrigin="anonymous"
      />
    </div>
  );
}
