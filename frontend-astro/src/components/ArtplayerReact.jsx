import React, { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

export default function ArtPlayerReact({ url, style }) {
  const artRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artRef.current || !url) return;

    let art = null;
    try {
      console.log('[ArtplayerReact] Initializing with url:', url);
      art = new Artplayer({
        container: artRef.current,
        url: url,
        type: 'm3u8',
        autoplay: true,
        muted: true, // For autoplay policy
        volume: 0.5,
        theme: '#ED2C25',
        fullscreen: true,
        playsInline: true,
        setting: true,
        pip: true,
        customType: {
          m3u8: function (video, playUrl, art) {
            if (Hls.isSupported()) {
              if (art.hls) art.hls.destroy();
              const hls = new Hls({
                maxLoadingDelay: 4,
                minAutoBitrate: 0,
                lowLatencyMode: false,
              });
              
              hls.loadSource(playUrl);
              hls.attachMedia(video);
              
              hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.log('[Hls] fatal network error encountered, try to recover in 2s');
                      setTimeout(() => {
                        if (hls) hls.startLoad();
                      }, 2000);
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('[Hls] fatal media error encountered, try to recover');
                      hls.recoverMediaError();
                      break;
                    default:
                      hls.destroy();
                      break;
                  }
                }
              });

              art.hls = hls;
              art.on('destroy', () => hls.destroy());
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = playUrl;
            } else {
              art.notice.show = 'Unsupported video format';
            }
          }
        },
      });

      art.on('video:error', () => {
        setError('Không thể kết nối đến luồng phát (Video Error)!');
      });
      
      art.on('ready', () => {
        console.log('[ArtplayerReact] Player is ready!');
        setError(null);
      });

    } catch (err) {
      console.error('[ArtplayerReact] Init error:', err);
      setError(err.message || 'Lỗi khởi tạo player');
    }

    return () => {
      console.log('[ArtplayerReact] Cleanup');
      if (art && art.destroy) {
        try {
          art.destroy(false);
        } catch (e) { console.error('Artplayer destroy error:', e); }
      }
      if (artRef.current) {
        artRef.current.innerHTML = '';
      }
    };
  }, [url]);

  return (
    <div style={{ ...style, position: 'relative', backgroundColor: '#000' }}>
      <div ref={artRef} style={{ width: '100%', height: '100%' }}></div>
      {error && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          background: 'rgba(220,38,38,0.9)', color: '#fff',
          padding: '6px 12px', borderRadius: 6, fontSize: '0.8rem',
          textAlign: 'center',
          zIndex: 9999
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
