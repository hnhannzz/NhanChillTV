import React, { useEffect, useRef, useState } from 'react';

/**
 * JWPlayerReact — Dựa trên KratosRepo/drm-player (embbed.html)
 * Engine: JW Player CDN (https://content.jwplatform.com/libraries/SAHhwvZq.js)
 * Hỗ trợ: DASH (.mpd) + HLS (.m3u8) + ClearKey DRM
 * ClearKey format: Base64URL keys từ m3u-parser → convert sang hex cho JW Player
 */
export default function JWPlayerReact({ url, clearKey, isMpd, style, onError }) {
  const playerId = useRef(`jwplayer-${Math.random().toString(36).substr(2, 9)}`).current;
  const playerRef = useRef(null);
  const [error, setError] = useState(null);

  // Load JW Player script từ CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.jwplayer) return; // Đã load rồi

    const scriptId = 'jwplayer-cdn-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://content.jwplatform.com/libraries/SAHhwvZq.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Khởi tạo player khi URL thay đổi
  useEffect(() => {
    if (!url || typeof window === 'undefined') return;

    let destroyed = false;

    const initPlayer = () => {
      if (destroyed) return;
      const container = document.getElementById(playerId);
      if (!container) return;
      
      if (typeof window.jwplayer !== 'function') {
        // Chờ script load xong
        setTimeout(initPlayer, 200);
        return;
      }

      // Mặc định isMpd prop = true vì JWPlayer chủ yếu chạy DRM MPD, nhưng cho phép config fallback
      const typeStr = isMpd || (isMpd === undefined && url.toLowerCase().includes('.mpd')) ? 'dash' : 'hls';

      // Config theo chuẩn KratosRepo/drm-player
      const config = {
        file: url,
        autostart: true,
        stretching: 'uniform',
        width: '100%',
        height: '100%',
        type: typeStr,
        cast: {},
      };

      // ClearKey DRM — chuyển Base64URL → hex cho JW Player
      if (clearKey && Object.keys(clearKey).length > 0) {
        const keys = Object.entries(clearKey);
        if (keys.length > 0) {
          const [kidB64, keyB64] = keys[0];
          config.drm = {
            clearkey: {
              keyId: base64urlToHex(kidB64),
              key: base64urlToHex(keyB64),
            }
          };
          console.log('[JWPlayer] ClearKey configured');
        }
      }

      console.log('[JWPlayer] Loading:', url.substring(0, 80) + '...');
      console.log('[JWPlayer] Type:', config.type, '| DRM:', !!config.drm);

      const player = window.jwplayer(playerId).setup(config);
      playerRef.current = player;

      player.on('ready', () => {
        console.log('[JWPlayer] Ready');
        setError(null);
      });

      player.on('error', (e) => {
        console.error('[JWPlayer] Playback error:', e);
        setError(e.message || 'Playback error');
        if (onError) onError(e);
      });

      player.on('setupError', (e) => {
        console.error('[JWPlayer] Setup error:', e);
        setError(e.message || 'Setup error');
        if (onError) onError(e);
      });
    };

    initPlayer();

    return () => {
      destroyed = true;
      try {
        if (playerRef.current && typeof playerRef.current.remove === 'function') {
          playerRef.current.remove();
        }
      } catch (e) { /* ignore */ }
      playerRef.current = null;
    };
  }, [url, clearKey, playerId]);

  return (
    <div style={{ ...style, position: 'relative', backgroundColor: '#000' }}>
      <div id={playerId} style={{ width: '100%', height: '100%' }}></div>
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

/** Base64URL → hex string */
function base64urlToHex(b64url) {
  if (/^[0-9a-fA-F]+$/.test(b64url)) return b64url.toLowerCase();
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bytes = atob(b64);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
