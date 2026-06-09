import React, { useEffect, useRef, useCallback } from 'react';

/**
 * ShakaPlayerReact — Universal player dùng Shaka Player
 * Hỗ trợ: HLS (.m3u8) + DASH (.mpd) + ClearKey DRM
 * ClearKey format: Base64URL (từ m3u-parser)
 */
export default function ShakaPlayerReact({ url, clearKey, style }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const shakaRef = useRef(null);

  const destroyPlayer = useCallback(async () => {
    if (playerRef.current) {
      try {
        await playerRef.current.destroy();
      } catch (e) {
        console.warn('[Shaka] destroy error:', e);
      }
      playerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Dynamic import để tránh SSR "document is not defined"
      const shaka = await import('shaka-player/dist/shaka-player.compiled.js');
      shakaRef.current = shaka.default || shaka;

      if (cancelled) return;

      // Cài polyfills
      shakaRef.current.polyfill.installAll();

      if (!shakaRef.current.Player.isBrowserSupported()) {
        console.error('[Shaka] Browser not supported');
        return;
      }

      await destroyPlayer();

      const video = videoRef.current;
      if (!video || cancelled) return;

      const player = new shakaRef.current.Player();
      await player.attach(video);
      playerRef.current = player;

      // Cấu hình retry và streaming cho proxy
      player.configure({
        streaming: {
          retryParameters: {
            maxAttempts: 5,
            baseDelay: 1000,
            backoffFactor: 2,
            timeout: 30000,
          },
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30,
        },
        manifest: {
          retryParameters: {
            maxAttempts: 5,
            baseDelay: 1000,
            backoffFactor: 2,
            timeout: 30000,
          },
        },
      });

      // ClearKey DRM — Shaka dùng hex format
      if (clearKey && Object.keys(clearKey).length > 0) {
        // Chuyển Base64URL -> hex cho Shaka Player
        const hexKeys = {};
        for (const [kid, key] of Object.entries(clearKey)) {
          hexKeys[base64urlToHex(kid)] = base64urlToHex(key);
        }
        player.configure({
          drm: {
            clearKeys: hexKeys,
          },
        });
        console.log('[Shaka] ClearKey configured:', Object.keys(hexKeys).length, 'keys');
      }

      // Error handler
      player.addEventListener('error', (event) => {
        const error = event.detail;
        console.error('[Shaka] Error code:', error.code, 'severity:', error.severity, error);
      });

      // Load manifest
      try {
        console.log('[Shaka] Loading:', url);
        await player.load(url);
        console.log('[Shaka] Loaded successfully');
        video.play().catch(e => console.log('[Shaka] Autoplay blocked:', e.message));
      } catch (e) {
        console.error('[Shaka] Load error:', e.code, e.message || e);
      }
    };

    if (url) {
      init();
    }

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [url, clearKey, destroyPlayer]);

  return (
    <div style={{ ...style, position: 'relative', backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        controls
        autoPlay
        style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
      />
    </div>
  );
}

/**
 * Base64URL → hex string
 */
function base64urlToHex(b64url) {
  // Nếu đã là hex (chỉ chứa 0-9a-f), trả nguyên
  if (/^[0-9a-fA-F]+$/.test(b64url)) {
    return b64url.toLowerCase();
  }
  // Chuyển Base64URL -> Base64 chuẩn
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  // Decode Base64 -> bytes -> hex
  const bytes = atob(b64);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
