import React, { useEffect, useMemo, useRef, useState } from 'react';

const JW_SCRIPT_ID = 'jwplayer-cdn-script';
const JW_SCRIPT_URL = 'https://content.jwplatform.com/libraries/SAHhwvZq.js';

export default function JWPlayerReact({ url, fallbackUrls = [], clearKey, isMpd, style, onError }) {
  const playerId = useRef(`jwplayer-${Math.random().toString(36).slice(2, 11)}`).current;
  const playerRef = useRef(null);
  const fallbackIndexRef = useRef(0);
  const [error, setError] = useState(null);

  const playbackUrls = useMemo(() => {
    return [url, ...fallbackUrls].filter(Boolean);
  }, [url, fallbackUrls]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.jwplayer || document.getElementById(JW_SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = JW_SCRIPT_ID;
    script.src = JW_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!url || typeof window === 'undefined') return undefined;

    let destroyed = false;
    let pollTimeout = null;

    const removePlayer = () => {
      try {
        if (playerRef.current && typeof playerRef.current.remove === 'function') {
          playerRef.current.remove();
        }
      } catch (err) {
        console.warn('[JWPlayer] remove error:', err);
      }
      playerRef.current = null;
    };

    const buildConfig = (playbackUrl) => {
      const cleanUrl = playbackUrl.toLowerCase().split('?')[0];
      const type = isMpd || cleanUrl.endsWith('.mpd') ? 'dash' : 'hls';
      const source = { file: playbackUrl, type };

      if (clearKey && Object.keys(clearKey).length > 0) {
        const [kid, key] = Object.entries(clearKey)[0];
        source.drm = {
          clearkey: {
            keyId: normalizeClearKeyValue(kid),
            key: normalizeClearKeyValue(key),
          },
        };
      }

      return {
        autostart: true,
        controls: true,
        stretching: 'uniform',
        width: '100%',
        height: '100%',
        primary: 'html5',
        preload: 'auto',
        liveTimeout: 60,
        cast: {},
        playlist: [{ sources: [source] }],
      };
    };

    const setupPlayer = (index = 0) => {
      if (destroyed) return;
      const container = document.getElementById(playerId);
      const playbackUrl = playbackUrls[index];
      if (!container || !playbackUrl) return;

      if (typeof window.jwplayer !== 'function') {
        pollTimeout = setTimeout(() => setupPlayer(index), 200);
        return;
      }

      fallbackIndexRef.current = index;
      setError(null);
      removePlayer();

      const config = buildConfig(playbackUrl);
      console.log('[JWPlayer] Loading:', playbackUrl.substring(0, 80) + '...');
      const source = config.playlist?.[0]?.sources?.[0];
      console.log('[JWPlayer] Type:', source?.type, '| DRM:', Boolean(source?.drm));

      const player = window.jwplayer(playerId).setup(config);
      playerRef.current = player;

      player.on('ready', () => {
        setError(null);
      });

      const handleError = (event, label) => {
        console.error(`[JWPlayer] ${label}:`, event);
        if (fallbackIndexRef.current + 1 < playbackUrls.length) {
          setupPlayer(fallbackIndexRef.current + 1);
          return;
        }

        setError(event?.message || label);
        onError && onError(event);
      };

      player.on('error', (event) => handleError(event, 'Playback error'));
      player.on('setupError', (event) => handleError(event, 'Setup error'));
    };

    setupPlayer(0);

    return () => {
      destroyed = true;
      if (pollTimeout) clearTimeout(pollTimeout);
      removePlayer();
    };
  }, [clearKey, isMpd, onError, playbackUrls, playerId, url]);

  return (
    <div style={{ ...style, position: 'relative', backgroundColor: '#000' }}>
      <div id={playerId} style={{ width: '100%', height: '100%' }} />
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          background: 'rgba(220,38,38,0.9)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: '0.8rem',
          textAlign: 'center',
          zIndex: 9999,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

function normalizeClearKeyValue(value) {
  const text = String(value || '').trim();
  const compactHex = text.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(compactHex)) return compactHex.toLowerCase();

  try {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const bytes = atob(b64);
    let hex = '';
    for (let i = 0; i < bytes.length; i += 1) {
      hex += bytes.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
  } catch (err) {
    console.warn('[JWPlayer] ClearKey normalize failed:', err);
    return text;
  }
}
