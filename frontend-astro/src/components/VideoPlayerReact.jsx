import React, { useEffect, useMemo, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { getMimeType, inferPlaybackType } from '../lib/playbackUrl';

const MAX_RETRIES = 5;

export const VideoPlayerReact = (props) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const [error, setError] = useState(null);
  const {
    url,
    type,
    poster,
    style,
    className = '',
    autoplay = true,
    muted = true,
    options,
    onReady,
    onError,
  } = props;

  const source = useMemo(() => {
    const src = url || options?.sources?.[0]?.src || options?.sources?.src;
    const sourceType = inferPlaybackType(src, type || options?.sources?.[0]?.type);
    return src ? { src, type: getMimeType(sourceType) } : null;
  }, [url, type, options]);

  const playerOptions = useMemo(() => ({
    controls: true,
    autoplay: autoplay ? 'muted' : false,
    muted,
    preload: 'auto',
    liveui: true,
    responsive: true,
    fill: true,
    poster,
    html5: {
      vhs: {
        overrideNative: !videojs.browser.IS_SAFARI,
        enableLowInitialPlaylist: true,
        smoothQualityChange: true,
        useBandwidthFromLocalStorage: true,
        limitRenditionByPlayerDimensions: true,
        handleManifestRedirects: true,
        maxPlaylistRetries: 10,
      },
      nativeAudioTracks: false,
      nativeVideoTracks: false,
      nativeTextTracks: false,
    },
    ...(options || {}),
    sources: source ? [source] : [],
  }), [autoplay, muted, options, poster, source]);

  useEffect(() => {
    if (!videoRef.current || !source) return undefined;

    const clearRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const play = (player) => {
      if (!autoplay) return;
      player.play()?.catch((err) => {
        console.log('[Video.js] autoplay blocked:', err.message);
      });
    };

    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');

      videoElement.classList.add('vjs-big-play-centered');
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, playerOptions, () => {
        onReady && onReady(player);
        play(player);
      });

      player.on('playing', () => {
        retryCountRef.current = 0;
        setError(null);
      });

      player.on('error', () => {
        const playerError = player.error();
        const message = playerError?.message || 'Khong the phat luong video';
        setError(message);
        onError && onError(playerError);

        if (retryCountRef.current >= MAX_RETRIES) return;
        retryCountRef.current += 1;
        const delay = Math.min(1000 * retryCountRef.current, 5000);

        clearRetry();
        retryTimeoutRef.current = setTimeout(() => {
          if (!playerRef.current || playerRef.current.isDisposed()) return;
          player.error(null);
          player.src(source);
          player.load();
          play(player);
        }, delay);
      });
    } else {
      const player = playerRef.current;
      clearRetry();
      retryCountRef.current = 0;
      setError(null);
      player.autoplay(playerOptions.autoplay);
      player.muted(playerOptions.muted);
      if (poster) player.poster(poster);
      player.src(source);
      player.load();
      play(player);
    }

    return clearRetry;
  }, [autoplay, muted, onError, onReady, playerOptions, poster, source]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      const player = playerRef.current;
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className={className} style={{ width: '100%', height: '100%', position: 'relative', background: '#000', ...style }}>
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
      {error && (
        <div style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 8,
          zIndex: 20,
          borderRadius: 6,
          background: 'rgba(185, 28, 28, 0.92)',
          color: '#fff',
          padding: '6px 10px',
          fontSize: 12,
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default VideoPlayerReact;
