import React, { useEffect, useMemo, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { getMimeType, inferPlaybackType } from '../lib/playbackUrl';

const RETRIES_PER_SOURCE = 1;
const STALL_RECOVERY_MS = 12000;

export const VideoPlayerReact = (props) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const stallTimeoutRef = useRef(null);
  const sourceIndexRef = useRef(0);
  const retryCountRef = useRef(0);
  const sourcesRef = useRef([]);
  const [error, setError] = useState(null);
  const {
    url,
    fallbackUrls = [],
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

  const sources = useMemo(() => {
    const optionSources = Array.isArray(options?.sources)
      ? options.sources.map(source => source?.src).filter(Boolean)
      : [options?.sources?.src].filter(Boolean);
    const urls = [url, ...fallbackUrls, ...optionSources].filter(Boolean);
    return [...new Set(urls)].map(src => ({
      src,
      type: getMimeType(inferPlaybackType(src, type || options?.sources?.[0]?.type)),
    }));
  }, [fallbackUrls, options, type, url]);

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
        smoothQualityChange: false,
        useBandwidthFromLocalStorage: false,
        limitRenditionByPlayerDimensions: true,
        handleManifestRedirects: true,
        maxPlaylistRetries: 6,
        playlistExclusionDuration: 30,
      },
      nativeAudioTracks: false,
      nativeVideoTracks: false,
      nativeTextTracks: false,
    },
    ...(options || {}),
    sources: sources.slice(0, 1),
  }), [autoplay, muted, options, poster, sources]);

  useEffect(() => {
    if (!videoRef.current || !sources.length) return undefined;

    sourcesRef.current = sources;
    sourceIndexRef.current = 0;
    retryCountRef.current = 0;
    setError(null);

    const clearTimers = () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      retryTimeoutRef.current = null;
      stallTimeoutRef.current = null;
    };

    const play = (player) => {
      if (!autoplay) return;
      player.play()?.catch(err => console.info('[Video.js] Autoplay blocked:', err.message));
    };

    const loadSource = (player, index) => {
      const nextSource = sourcesRef.current[index];
      if (!nextSource || player.isDisposed()) return;
      player.error(null);
      player.src(nextSource);
      player.load();
      play(player);
    };

    const handlePlaybackError = (player) => {
      const playerError = player.error();
      const currentIndex = sourceIndexRef.current;

      if (retryCountRef.current < RETRIES_PER_SOURCE) {
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(() => loadSource(player, currentIndex), 1000);
        return;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex < sourcesRef.current.length) {
        sourceIndexRef.current = nextIndex;
        retryCountRef.current = 0;
        setError('Nguồn trực tiếp không ổn định, đang chuyển sang máy chủ dự phòng...');
        retryTimeoutRef.current = setTimeout(() => loadSource(player, nextIndex), 350);
        return;
      }

      const message = playerError?.message || 'Không thể phát luồng video';
      setError(message);
      onError?.(playerError);
    };

    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, playerOptions, () => {
        onReady?.(player);
        play(player);
      });

      player.on('playing', () => {
        retryCountRef.current = 0;
        setError(null);
        if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      });
      player.on('error', () => handlePlaybackError(player));
      player.on('waiting', () => {
        if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = setTimeout(() => {
          if (!player.isDisposed() && !player.paused()) loadSource(player, sourceIndexRef.current);
        }, STALL_RECOVERY_MS);
      });
    } else {
      const player = playerRef.current;
      clearTimers();
      player.autoplay(playerOptions.autoplay);
      player.muted(playerOptions.muted);
      if (poster) player.poster(poster);
      loadSource(player, 0);
    }

    return clearTimers;
  }, [autoplay, muted, onError, onReady, playerOptions, poster, sources]);

  useEffect(() => () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    const player = playerRef.current;
    if (player && !player.isDisposed()) player.dispose();
    playerRef.current = null;
  }, []);

  return (
    <div data-vjs-player className={className} style={{ width: '100%', height: '100%', position: 'relative', background: '#000', ...style }}>
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
      {error && (
        <div className="absolute bottom-2 left-2 right-2 z-20 rounded-md bg-red-700/95 px-3 py-2 text-center text-xs text-white">
          {error}
        </div>
      )}
    </div>
  );
};

export default VideoPlayerReact;
