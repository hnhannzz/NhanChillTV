import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, LightbulbOff, Settings, Mic, Cast, Check } from 'lucide-react';
import { inferPlaybackType } from '../lib/playbackUrl';

let castSenderScriptPromise = null;

const loadCastSenderFramework = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Cast only works in the browser'));
  if (window.cast?.framework && window.chrome?.cast) return Promise.resolve();

  if (!castSenderScriptPromise) {
    castSenderScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-nhanchill-cast-sdk="true"]');
      const timeout = window.setTimeout(() => reject(new Error('Cast SDK load timeout')), 10000);

      window.__onGCastApiAvailable = (isAvailable) => {
        window.clearTimeout(timeout);
        if (isAvailable && window.cast?.framework && window.chrome?.cast) {
          resolve();
        } else {
          reject(new Error('Cast SDK is not available'));
        }
      };

      if (existingScript) {
        const checkReady = () => {
          if (window.cast?.framework && window.chrome?.cast) {
            window.clearTimeout(timeout);
            resolve();
            return;
          }
          window.setTimeout(checkReady, 100);
        };
        checkReady();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.dataset.nhanchillCastSdk = 'true';
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('Cannot load Cast SDK'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      castSenderScriptPromise = null;
      throw error;
    });
  }

  return castSenderScriptPromise;
};

export default function UnifiedPlayer({
  url,
  poster,
  autoplay = true,
  muted = false,
  className = '',
  clearKey,
  isMpd,
  streamType,
  onNextEpisode,
  onCinemaMode,
  audioVariants = [],
  currentAudioVariantId = '',
  onSelectAudioVariant,
  skipResumePrompt = false,
  title,
  subTitle,
  initialTime = 0,
  onTimeUpdate,
  onReady,
  onError,
  isLive,
}) {
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  
  // Custom Controls State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(initialTime > 5 && isLive !== true);

  // Seeking optimizations
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekingTime, setSeekingTime] = useState(0);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  // Settings & Custom Features State
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [castMessage, setCastMessage] = useState('');
  
  // Context Menu & Custom Modals
  const [contextMenu, setContextMenu] = useState(null);
  const [showCodecModal, setShowCodecModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isLiveStream = isLive ?? (duration === Infinity || !isFinite(duration) || subTitle === 'Live TV');
  const shouldGateResume = !skipResumePrompt && initialTime > 5 && isLive !== true;
  const hasAudioVariants = Array.isArray(audioVariants) && audioVariants.length > 0;
  const selectedAudioVariant = audioVariants.find(item => item.id === currentAudioVariantId) || audioVariants[0];

  // Mobile/touch detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
  }, []);

  // Detect iOS Safari or macOS Safari
  const isSafariOrIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (/Safari/.test(navigator.userAgent) && !/Chrome|CriOS|Android/.test(navigator.userAgent))
  );

  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  const getResolvedPlaybackType = () => {
    if (isMpd || streamType === 'mpd' || streamType === 'dash') return 'dash';
    if (streamType === 'hls') return 'hls';
    if (streamType === 'mpegts') return 'mpegts';
    if (streamType === 'progressive' || streamType === 'mp4') return 'mp4';
    return inferPlaybackType(url);
  };

  const getCastContentType = () => {
    const playbackType = getResolvedPlaybackType();
    if (playbackType === 'dash') return 'application/dash+xml';
    if (playbackType === 'mp4') return 'video/mp4';
    if (playbackType === 'mpegts') return 'video/mp2t';
    return 'application/x-mpegURL';
  };

  const normalizeClearKeyHex = (value) => {
    const clean = String(value || '').trim().replace(/^0x/i, '').replace(/-/g, '').toLowerCase();
    return /^[0-9a-f]{32}$/.test(clean) ? clean : null;
  };

  const base64KeyToHex = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
      const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const binary = window.atob(padded);
      const hex = Array.from(binary, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      return /^[0-9a-f]{32}$/.test(hex) ? hex : null;
    } catch (e) {
      return null;
    }
  };

  const normalizeClearKeyValue = (value) => normalizeClearKeyHex(value) || base64KeyToHex(value);

  const normalizeClearKeys = (source) => {
    const keys = {};
    if (!source) return keys;

    const addKey = (kidValue, keyValue) => {
      const kid = normalizeClearKeyValue(kidValue);
      const key = normalizeClearKeyValue(keyValue);
      if (kid && key) keys[kid] = key;
    };

    const collectFromJson = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(collectFromJson);
        return;
      }
      if (typeof value !== 'object') return;

      const kid = value.kid || value.keyid || value.keyId || value.KID;
      const key = value.k || value.key || value.KEY || value.value;
      if (kid && key) addKey(kid, key);

      const nested = value.keys || value.clearkey || value.clearKey || value.clearKeys;
      if (Array.isArray(nested)) {
        nested.forEach(collectFromJson);
      } else if (nested && typeof nested === 'object') {
        Object.entries(nested).forEach(([entryKid, entryKey]) => {
          if (typeof entryKey === 'string') addKey(entryKid, entryKey);
          else collectFromJson(entryKey);
        });
      }

      Object.entries(value).forEach(([entryKid, entryValue]) => {
        if (typeof entryValue === 'string') addKey(entryKid, entryValue);
        else if (entryValue && typeof entryValue === 'object') collectFromJson(entryValue);
      });
    };

    if (typeof source === 'string') {
      const raw = source.trim();
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          collectFromJson(JSON.parse(raw));
        } catch (e) {}
      }

      const pairPattern = /([0-9a-fA-F]{32}|[0-9a-fA-F-]{36}|[A-Za-z0-9_-]{22})\s*[:=]\s*([0-9a-fA-F]{32}|[0-9a-fA-F-]{36}|[A-Za-z0-9_-]{22})/g;
      let match;
      while ((match = pairPattern.exec(raw)) !== null) {
        addKey(match[1], match[2]);
      }
    } else if (typeof source === 'object') {
      collectFromJson(source);
    }

    return keys;
  };

  const getShakaErrorCodes = (err) => {
    const codes = new Set();
    const visit = (value, depth = 0) => {
      if (!value || depth > 4) return;
      if (typeof value.code === 'number') codes.add(value.code);
      if (Array.isArray(value.data)) value.data.forEach(item => visit(item, depth + 1));
    };
    visit(err);
    return codes;
  };

  const formatPlaybackError = (err, hasClearKeys) => {
    const codes = getShakaErrorCodes(err);
    if (hasClearKeys && codes.has(6007)) {
      return 'Lỗi DRM ClearKey: key hiện tại không khớp với manifest hoặc nguồn đã đổi key. Vui lòng cập nhật lại key/nguồn trong M3U.';
    }
    if (codes.has(6014)) {
      return 'Lỗi DRM: license/key đã hết hạn. Vui lòng cập nhật nguồn hoặc ClearKey mới.';
    }
    if (codes.has(6007)) {
      return 'Lỗi DRM: không lấy được license từ nguồn phát. Có thể license server/proxy bị chặn hoặc nguồn đã đổi key.';
    }
    if (codes.has(6012)) {
      return 'Lỗi DRM: nguồn yêu cầu license server nhưng hệ thống chưa có license URL.';
    }
    return `Lỗi phát video: ${err?.message || 'Không thể tải luồng video'}`;
  };

  const maskKeyIds = (clearKeysObj) => Object.keys(clearKeysObj).map(kid => `${kid.slice(0, 6)}...${kid.slice(-4)}`);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsPipSupported(document.pictureInPictureEnabled || false);
    }
  }, []);

  useEffect(() => {
    setCurrentTime(shouldGateResume ? 0 : initialTime);
    setShowContinuePrompt(shouldGateResume);
    setShowAudioMenu(false);
  }, [url, initialTime, shouldGateResume]);

  useEffect(() => {
    if (!castMessage) return undefined;
    const timer = window.setTimeout(() => setCastMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [castMessage]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoContainerRef.current) return;

    let shakaPlayer = null;
    let mpegtsPlayer = null;
    let doSeek = null;
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeoutId = null;

    const playbackType = getResolvedPlaybackType();
    const isDash = playbackType === 'dash';
    const isMpegTs = playbackType === 'mpegts';
    const isProgressive = playbackType === 'mp4';
    let activeHasClearKeys = false;

    const handleNativeError = () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const mediaError = videoEl.error;
      console.warn('[Player] Native playback error:', mediaError?.code, mediaError?.message);

      if (isSafariOrIOS && !isDash && retryCount < maxRetries) {
        retryCount++;
        console.log(`[Player] Retrying native HLS source in 3s (Attempt ${retryCount}/${maxRetries})...`);
        setError(`Đang kết nối lại luồng phát (Thử lại ${retryCount}/${maxRetries})...`);

        retryTimeoutId = setTimeout(() => {
          if (videoRef.current && url) {
            videoRef.current.src = url;
            videoRef.current.load();
            videoRef.current.play().catch(() => {});
          }
        }, 3000);
      } else {
        setError(mediaError ? `Lỗi trình phát: ${mediaError.message || 'Lỗi tải luồng video'}` : 'Lỗi tải luồng video');
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const handleLoadedMetadata = () => setDuration(video.duration);

    const handleWebKitBeginFullscreen = () => setIsFullscreen(true);
    const handleWebKitEndFullscreen = () => setIsFullscreen(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('webkitbeginfullscreen', handleWebKitBeginFullscreen);
    video.addEventListener('webkitendfullscreen', handleWebKitEndFullscreen);
    video.addEventListener('error', handleNativeError);

    const setupPlayback = async () => {
      setError(null);
      setAvailableQualities([]);
      setCurrentQuality('auto');
      playerRef.current = null;

      if (isDash && isSafariOrIOS) {
        setError('Kênh/phim định dạng MPD (DASH) này chưa hỗ trợ iOS, iPadOS hoặc Safari. Vui lòng dùng Chrome/Edge trên Windows hoặc Android.');
        return;
      }

      try {
        if (isMpegTs) {
          const mpegtsModule = await import('mpegts.js');
          if (cancelled) return;
          const mpegts = mpegtsModule.default || mpegtsModule;

          if (mpegts.isSupported()) {
            const absoluteUrl = new URL(url, window.location.href).href;

            mpegtsPlayer = mpegts.createPlayer({
              type: 'mpegts',
              isLive: true,
              url: absoluteUrl,
            }, {
              enableWorker: true,
              lazyLoad: false,
              enableStashBuffer: false,
              liveBufferLatencyChasing: true,
            });
            playerRef.current = mpegtsPlayer;

            mpegtsPlayer.attachMediaElement(video);
            mpegtsPlayer.load();
            if (autoplay) {
              mpegtsPlayer.play().catch(err => {
                console.warn('Autoplay unmuted prevented for mpegts, trying muted...', err);
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  setIsMuted(true);
                  setShowUnmuteHint(true);
                  videoRef.current.play().catch(() => {});
                }
              });
            }
            onReady?.(null);

            mpegtsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
              console.error('MPEG-TS Error:', errorType, errorDetail, errorInfo);
              setError(`Lỗi MPEG-TS: ${errorDetail}`);
              onError?.(errorInfo);
            });
            return;
          }
        }

        if ((isSafariOrIOS && !isDash) || isProgressive) {
          console.log('[Player] Using native HTML5 playback engine');
          video.src = url;
          video.load();

          let seeked = false;
          doSeek = () => {
            if (seeked) return;
            if (!shouldGateResume && initialTime > 0 && videoRef.current && videoRef.current.duration > 0) {
              videoRef.current.currentTime = initialTime;
              seeked = true;
              console.log('[Player] Native HLS seeked to:', initialTime);
            }
          };

          video.addEventListener('loadedmetadata', doSeek);
          video.addEventListener('loadeddata', doSeek);
          video.addEventListener('canplay', doSeek);

          if (autoplay && !shouldGateResume) {
            video.play().catch(err => {
              console.warn('Native HLS autoplay unmuted prevented, trying muted...', err);
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                setShowUnmuteHint(true);
                videoRef.current.play().catch(() => {});
              }
            });
          }
          onReady?.(null);
          return;
        }

        const shakaModule = isDash
          ? await import('shaka-player/dist/shaka-player.dash-es2021.js')
          : await import('shaka-player/dist/shaka-player.hls-es2021.js');
        if (cancelled) return;
        const shaka = shakaModule.default || shakaModule;

        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          setError('Browser không hỗ trợ Shaka Player');
          return;
        }

        shakaPlayer = new shaka.Player(video);
        playerRef.current = shakaPlayer;

        const clearKeysObj = normalizeClearKeys(clearKey);
        const hasClearKeys = Object.keys(clearKeysObj).length > 0;
        activeHasClearKeys = hasClearKeys;
        const clearKeyMappings = {
          'com.widevine.alpha': 'org.w3.clearkey',
          'com.microsoft.playready': 'org.w3.clearkey',
          'com.microsoft.playready.recommendation': 'org.w3.clearkey',
          'com.microsoft.playready.software': 'org.w3.clearkey',
          'com.microsoft.playready.hardware': 'org.w3.clearkey',
        };
        const clearKeyUriMappings = {
          'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'org.w3.clearkey',
          'urn:uuid:EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED': 'org.w3.clearkey',
          'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'org.w3.clearkey',
          'urn:uuid:9A04F079-9840-4286-AB92-E65BE0885F95': 'org.w3.clearkey',
          'urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e': 'org.w3.clearkey',
          'urn:uuid:E2719D58-A985-B3C9-781A-B030AF78D30E': 'org.w3.clearkey',
          'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'org.w3.clearkey',
          'urn:uuid:1077EFEC-C0B2-4D02-ACE3-3C1E52E2FB4B': 'org.w3.clearkey',
        };

        if (hasClearKeys) {
          console.info('[Player] ClearKey mode enabled', {
            keySystem: 'org.w3.clearkey',
            keyCount: Object.keys(clearKeysObj).length,
            keyIds: maskKeyIds(clearKeysObj),
            streamType: playbackType,
          });
        }

        const drmConfig = hasClearKeys ? {
          clearKeys: clearKeysObj,
          preferredKeySystems: ['org.w3.clearkey'],
          keySystemsMapping: clearKeyMappings,
          failureCallback: (drmError) => {
            console.warn('[Player] DRM failure', {
              codes: Array.from(getShakaErrorCodes(drmError)),
              keySystem: drmError?.data?.[1]?.keySystem || 'org.w3.clearkey',
              keyIds: maskKeyIds(clearKeysObj),
            });
          },
        } : undefined;

        const shakaConfig = {
          streaming: {
            bufferingGoal: 45,
            rebufferingGoal: 5,
            bufferBehind: 15,
            retryParameters: {
              maxAttempts: 5,
              timeout: 10000,
            },
            abr: {
              enabled: true,
              defaultBandwidthEstimate: 1500000,
              switchInterval: 4,
            },
          },
          drm: drmConfig,
        };

        if (hasClearKeys) {
          shakaConfig.manifest = {
            dash: {
              keySystemsByURI: clearKeyUriMappings,
            },
          };
        }

        shakaPlayer.configure(shakaConfig);

        shakaPlayer.addEventListener('error', (event) => {
          console.error('Player error', event.detail);
          setError(formatPlaybackError(event.detail, hasClearKeys));
          onError?.(event.detail);
        });

        await shakaPlayer.load(url, shouldGateResume ? 0 : initialTime);
        if (cancelled) return;
        if (hasClearKeys) {
          const drmInfo = typeof shakaPlayer.drmInfo === 'function' ? shakaPlayer.drmInfo() : null;
          console.info('[Player] DRM selected', {
            keySystem: drmInfo?.keySystem || 'unknown',
            licenseServer: drmInfo?.licenseServerUri ? 'configured' : 'none',
            keyIds: maskKeyIds(clearKeysObj),
          });
        }
        if (autoplay && !shouldGateResume) {
          video.play().catch(() => {
            console.warn('Shaka autoplay unmuted prevented, trying muted...');
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              setShowUnmuteHint(true);
              videoRef.current.play().catch(() => {});
            }
          });
        }

        const updateQualities = () => {
          if (!shakaPlayer) return;
          const tracks = shakaPlayer.getVariantTracks();
          const unique = [];
          const seen = new Set();
          for (const track of tracks) {
            if (track.height && !seen.has(track.height)) {
              seen.add(track.height);
              unique.push(track);
            }
          }
          unique.sort((a, b) => b.height - a.height);
          setAvailableQualities(unique);
        };

        shakaPlayer.addEventListener('trackschanged', updateQualities);
        updateQualities();

        onReady?.(shakaPlayer);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading video', err);
        setError(formatPlaybackError(err, activeHasClearKeys));
        onError?.(err);
      }
    };

    setupPlayback();

    return () => {
      cancelled = true;
      if (shakaPlayer) {
        shakaPlayer.destroy();
      }
      if (mpegtsPlayer) {
        mpegtsPlayer.destroy();
      }

      video.src = '';
      try {
        video.removeAttribute('src');
        video.load();
      } catch (e) {}

      if (retryTimeoutId) clearTimeout(retryTimeoutId);

      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('webkitbeginfullscreen', handleWebKitBeginFullscreen);
      video.removeEventListener('webkitendfullscreen', handleWebKitEndFullscreen);
      video.removeEventListener('error', handleNativeError);

      if (doSeek) {
        video.removeEventListener('loadedmetadata', doSeek);
        video.removeEventListener('loadeddata', doSeek);
        video.removeEventListener('canplay', doSeek);
      }
    };
  }, [url, isMpd, streamType, initialTime, autoplay, shouldGateResume, clearKey]);

  // Handle Fullscreen state change events, including webkit prefix
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          if (!isLiveStream) {
            video.currentTime = Math.max(0, video.currentTime - 5);
          }
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          if (!isLiveStream) {
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          setVolume(video.volume);
          setIsMuted(video.volume === 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          setVolume(video.volume);
          setIsMuted(video.volume === 0);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, duration, isLiveStream]);

  // Click outside to close context menu
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      setShowUnmuteHint(false);
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(e => console.warn('Play request failed/blocked:', e));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      setShowUnmuteHint(false);
      videoRef.current.muted = !isMuted;
    }
  };

  // Fullscreen support including iPhone / iOS Safari webkit fallback
  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = videoContainerRef.current;
    if (!video || !container) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement && !video.webkitDisplayingFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(err => {
          console.warn("Fullscreen error", err);
        });
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        // iOS Safari Fullscreen
        video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
    }
  };

  const togglePip = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        await videoRef.current.requestPictureInPicture();
      } catch (err) {
        console.error("Failed to enter Picture-in-Picture mode:", err);
      }
    }
  };

  const handleCast = async () => {
    const video = videoRef.current;
    if (!video || typeof window === 'undefined') return;

    if (!isIOS && !isSafariOrIOS) {
      setCastMessage('Đang tìm thiết bị Chromecast...');

      try {
        await loadCastSenderFramework();
        const castContext = window.cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        await castContext.requestSession();
        const session = castContext.getCurrentSession();
        if (!session) throw new Error('No Cast session');

        const castUrl = new URL(url, window.location.href).href;
        const mediaInfo = new window.chrome.cast.media.MediaInfo(castUrl, getCastContentType());
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = title || 'NhanChillTV';
        mediaInfo.metadata.subtitle = subTitle || '';
        if (poster) {
          mediaInfo.metadata.images = [new window.chrome.cast.Image(new URL(poster, window.location.href).href)];
        }

        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        request.currentTime = isLiveStream ? 0 : Math.max(0, Math.floor(video.currentTime || currentTime || 0));

        await session.loadMedia(request);
        setCastMessage('Đã gửi phim sang Chromecast.');
        return;
      } catch (castError) {
        console.warn('[Player] Chromecast sender failed:', castError);
      }

      try {
        if (video.remote && typeof video.remote.prompt === 'function') {
          await video.remote.prompt();
          setCastMessage('Đã mở trình chọn thiết bị phát.');
          return;
        }
      } catch (remoteError) {
        console.warn('[Player] Remote playback failed:', remoteError);
      }

      setCastMessage('Chrome chưa tìm thấy thiết bị Chromecast cùng mạng.');
      return;
    }

    if ((isIOS || isSafariOrIOS) && typeof video.webkitShowPlaybackTargetPicker === 'function') {
      video.webkitShowPlaybackTargetPicker();
      return;
    }

    if (window.chrome?.cast?.requestSession) {
      window.chrome.cast.requestSession(
        () => setCastMessage('Đã gửi yêu cầu kết nối Chromecast.'),
        () => setCastMessage('Chưa kết nối được Chromecast trên trình duyệt này.')
      );
      return;
    }

    setCastMessage(isIOS || isSafariOrIOS
      ? 'AirPlay chưa khả dụng trên trình duyệt này.'
      : 'Chromecast cần Chrome và thiết bị Cast cùng mạng.');
  };

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setSeekingTime(val);
  };

  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
    setIsSeeking(false);
  };

  const seekBy = (seconds) => {
    if (!videoRef.current || isLiveStream) return;
    const video = videoRef.current;
    const maxTime = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : (duration > 0 ? duration : Number.POSITIVE_INFINITY);
    const nextTime = Math.min(maxTime, Math.max(0, video.currentTime + seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const triggerControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    triggerControlsTimeout();
  };

  const continueWatching = () => {
    setShowContinuePrompt(false);
    if (videoRef.current) {
      videoRef.current.currentTime = initialTime;
      setCurrentTime(initialTime);
      videoRef.current.play().catch(() => {});
    }
  };

  const restartWatching = () => {
    setShowContinuePrompt(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const selectQuality = (height) => {
    if (!playerRef.current) return;
    if (height === 'auto') {
      playerRef.current.configure({ streaming: { abr: { enabled: true } } });
      setCurrentQuality('auto');
    } else {
      playerRef.current.configure({ streaming: { abr: { enabled: false } } });
      const tracks = playerRef.current.getVariantTracks();
      const bestTrack = tracks.find(t => t.height === height);
      if (bestTrack) {
        playerRef.current.selectVariantTrack(bestTrack, true);
        setCurrentQuality(height);
      }
    }
    setShowSettings(false);
  };

  const selectSpeed = (speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSettings(false);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!videoContainerRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y });
  };

  const getCodecInfo = () => {
    if (!playerRef.current || !videoRef.current) {
      return { type: 'N/A', width: 'N/A', height: 'N/A', videoCodec: 'N/A', audioCodec: 'N/A', bandwidth: 'N/A', decodedFrames: 0, droppedFrames: 0 };
    }
    if (typeof playerRef.current.getStats === 'function') {
      const stats = playerRef.current.getStats();
      const tracks = playerRef.current.getVariantTracks() || [];
      const activeTrack = tracks.find(t => t.active);
      return {
        type: 'Shaka Player',
        width: stats.width || activeTrack?.width || videoRef.current?.videoWidth || 'Unknown',
        height: stats.height || activeTrack?.height || videoRef.current?.videoHeight || 'Unknown',
        videoCodec: activeTrack?.videoCodec || 'h264',
        audioCodec: activeTrack?.audioCodec || 'aac',
        droppedFrames: stats.droppedFrames || 0,
        decodedFrames: stats.decodedFrames || 0,
        bandwidth: stats.streamBandwidth ? Math.round(stats.streamBandwidth / 1000) + ' kbps' : 'N/A',
      };
    } else {
      return {
        type: isSafariOrIOS ? 'iOS Safari Native engine' : 'MPEG-TS / Native HTML5',
        width: videoRef.current?.videoWidth || 'Unknown',
        height: videoRef.current?.videoHeight || 'Unknown',
        videoCodec: 'h264 (Phần cứng)',
        audioCodec: 'aac/mp3/mp2',
        droppedFrames: videoRef.current?.webkitDroppedFrameCount || 0,
        decodedFrames: videoRef.current?.webkitDecodedFrameCount || 0,
        bandwidth: 'N/A'
      };
    }
  };

  return (
    <div 
      ref={videoContainerRef} 
      className={`relative group bg-black overflow-hidden flex justify-center items-center ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={handleContextMenu}
    >
      <video
        ref={videoRef}
        className="w-full h-full max-h-screen object-contain"
        poster={poster}
        playsInline={true}
        {...{
          "webkit-playsinline": "true",
          "x-webkit-airplay": "allow"
        }}
      />

      {/* Click/Touch Overlay */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer"
        onTouchEnd={(e) => {
          setShowControls(prev => {
            const nextVal = !prev;
            if (nextVal) {
              triggerControlsTimeout();
            } else {
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            }
            return nextVal;
          });
        }}
        onClick={(e) => {
          if (isMobile) return;
          if (e.target !== e.currentTarget) return;
          togglePlay();
        }}
      />

      {/* Center Play Button Overlay */}
      {(!isPlaying || showControls) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center justify-center gap-6 sm:gap-8 md:gap-10">
            {!isLiveStream && (
              <button
                type="button"
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  seekBy(-5);
                }}
                onClick={(e) => {
                  if (isMobile) return;
                  e.stopPropagation();
                  seekBy(-5);
                }}
                className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-[#ED2C25] active:scale-95 sm:h-14 sm:w-14"
                title="Lui 5s"
              >
                <svg className="h-7 w-7 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                </svg>
              </button>
            )}

            <button
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePlay();
              }}
              onClick={(e) => {
                if (isMobile) return;
                e.stopPropagation();
                togglePlay();
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-[#ED2C25] hover:bg-[#ED2C25] active:scale-95 md:h-20 md:w-20"
            >
              {isPlaying ? (
                <Pause fill="currentColor" size={28} className="md:h-8 md:w-8" />
              ) : (
                <Play fill="currentColor" size={28} className="translate-x-0.5 md:h-8 md:w-8" />
              )}
            </button>

            {!isLiveStream && (
              <button
                type="button"
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  seekBy(5);
                }}
                onClick={(e) => {
                  if (isMobile) return;
                  e.stopPropagation();
                  seekBy(5);
                }}
                className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-[#ED2C25] active:scale-95 sm:h-14 sm:w-14"
                title="Tua 5s"
              >
                <svg className="h-7 w-7 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Continue Watching Prompt */}
      {showContinuePrompt && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm px-3">
          <div className="w-full max-w-[210px] rounded-lg border border-white/10 bg-[#121212] p-3 text-center shadow-2xl sm:max-w-sm sm:p-6">
            <h3 className="text-sm font-bold text-white sm:text-lg">Xem tiếp?</h3>
            <p className="mb-3 mt-1 text-xs text-white/70 sm:mb-4 sm:text-sm">Bạn đã dừng ở {formatTime(initialTime)}</p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <button onClick={continueWatching} className="w-full bg-[#ED2C25] text-white font-bold py-2 px-3 text-xs rounded-lg hover:bg-red-700 transition-colors sm:py-2.5 sm:px-4 sm:text-base">
                Tiếp tục xem
              </button>
              <button onClick={restartWatching} className="w-full bg-white/10 text-white font-bold py-2 px-3 text-xs rounded-lg hover:bg-white/20 transition-colors sm:py-2.5 sm:px-4 sm:text-base">
                Xem lại từ đầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg text-xs font-semibold max-w-[90%] text-center">
          {error}
        </div>
      )}

      {castMessage && (
        <div className="absolute right-3 top-16 z-50 max-w-[82%] rounded-lg border border-white/10 bg-[#151515]/95 px-3 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md sm:right-4 sm:top-4">
          {castMessage}
        </div>
      )}

      {/* Unmute Hint toast */}
      {showUnmuteHint && isMuted && isPlaying && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
            }
            setShowUnmuteHint(false);
          }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-45 bg-[#ED2C25] text-white px-4 py-2.5 rounded-full shadow-2xl text-[10px] sm:text-xs font-black tracking-wide flex items-center gap-2 animate-bounce cursor-pointer border border-white/20 pointer-events-auto"
        >
          <VolumeX size={14} className="animate-pulse" />
          <span>CHẠM ĐỂ BẬT ÂM THANH</span>
        </div>
      )}

      {/* Custom Controls UI */}
      <div 
        onClick={triggerControlsTimeout}
        className={`absolute inset-0 ${showAudioMenu ? 'z-[70]' : 'z-20'} pointer-events-none transition-opacity duration-300 flex flex-col justify-between ${showControls || !isPlaying || showAudioMenu ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Top Gradient & Title */}
        <div className="bg-gradient-to-b from-black/80 to-transparent px-4 pb-12 pt-3 sm:px-6 sm:pt-4 flex justify-between items-start pointer-events-auto">
          <div className="min-w-0 pr-3">
            <h2 className="max-w-[calc(100vw-8rem)] text-white font-bold text-base leading-tight drop-shadow-md sm:max-w-none md:text-xl">{title}</h2>
            {subTitle && <p className="text-white/80 text-xs md:text-sm drop-shadow-md">{subTitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button type="button" onClick={handleCast} className="grid h-9 w-9 place-items-center rounded-full bg-black/25 text-white/90 backdrop-blur-sm transition-colors hover:bg-[#ED2C25]/80 hover:text-white focus:outline-none" title={isIOS || isSafariOrIOS ? 'AirPlay' : 'Chromecast'}>
              <Cast size={20} />
            </button>
            {isPipSupported && (
              <button type="button" onClick={togglePip} className="grid h-9 w-9 place-items-center rounded-full bg-black/25 text-white/90 backdrop-blur-sm transition-colors hover:bg-[#ED2C25]/80 hover:text-white focus:outline-none" title="Xem hình trong hình (PiP)">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
                  <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Gradient & Controls */}
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-5 sm:px-3 sm:pt-12 md:px-6 md:pb-4 pointer-events-auto">
          {/* Progress Bar */}
          {!isLiveStream && (
            <div className="group/progress relative flex items-center h-4 cursor-pointer mb-2">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={isSeeking ? seekingTime : currentTime}
                onMouseDown={() => { setIsSeeking(true); setSeekingTime(currentTime); }}
                onTouchStart={() => { setIsSeeking(true); setSeekingTime(currentTime); }}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                className="absolute w-full h-1.5 opacity-0 cursor-pointer z-20"
              />
              <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden absolute z-0 pointer-events-none">
                <div 
                  className="h-full bg-[#ED2C25] transition-all duration-100 ease-linear pointer-events-none" 
                  style={{ width: `${duration > 0 ? ((isSeeking ? seekingTime : currentTime) / duration) * 100 : 0}%` }}
                />
              </div>
              <div 
                className="absolute h-3.5 w-3.5 bg-[#ED2C25] rounded-full z-10 pointer-events-none transform -translate-x-1/2 shadow-sm scale-0 group-hover/progress:scale-100 transition-transform"
                style={{ left: `${duration > 0 ? ((isSeeking ? seekingTime : currentTime) / duration) * 100 : 0}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 sm:hidden">
              <div className="order-3 shrink-0">
                <button onClick={toggleMute} className="grid h-7 w-7 place-items-center text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>

              <div className="order-1 flex shrink-0 items-center justify-center gap-1">
                {!isLiveStream && (
                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                    }}
                    className="hidden h-7 w-7 place-items-center text-white hover:text-[#ED2C25] transition-colors focus:outline-none"
                    title="Lùi 5s"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                    </svg>
                  </button>
                )}

                <button onClick={togglePlay} className="grid h-8 w-8 place-items-center text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                  {isPlaying ? <Pause fill="currentColor" size={26} /> : <Play fill="currentColor" size={26} />}
                </button>

                {onNextEpisode && (
                  <button type="button" onClick={onNextEpisode} className="grid h-7 w-7 shrink-0 place-items-center text-white/85 hover:text-white transition-colors focus:outline-none" title="Tập tiếp">
                    <SkipForward size={19} />
                  </button>
                )}

                {!isLiveStream && (
                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 5);
                    }}
                    className="hidden h-7 w-7 place-items-center text-white hover:text-[#ED2C25] transition-colors focus:outline-none"
                    title="Tua 5s"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                    </svg>
                  </button>
                )}
              </div>

              {isLiveStream ? (
                <span className="order-4 ml-auto flex items-center gap-1.5 text-[#ED2C25] font-black text-[10px] uppercase bg-[#ED2C25]/10 px-2 py-0.5 rounded border border-[#ED2C25]/20 tracking-wider select-none">
                  <span className="h-1.5 w-1.5 bg-[#ED2C25] rounded-full animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="order-4 ml-auto shrink-0 whitespace-nowrap rounded-full bg-black/20 px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-wide text-white/90">
                  {formatTime(isSeeking ? seekingTime : currentTime)} <span className="text-white/40 mx-1">/</span> {formatTime(duration)}
                </span>
              )}
            </div>

            <div className="hidden w-full min-w-0 items-center justify-between gap-2 sm:flex sm:w-auto sm:justify-start md:gap-4">
              {/* Skip backward 5s */}
              {!isLiveStream && (
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                  }}
                  className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none"
                  title="Lùi 5s"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                  </svg>
                </button>
              )}

              <button onClick={togglePlay} className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
              </button>

              {/* Skip forward 5s */}
              {!isLiveStream && (
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 5);
                  }}
                  className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none"
                  title="Tua 5s"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <text x="12" y="15" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
                  </svg>
                </button>
              )}
              
              <div className="flex items-center gap-2 group/volume relative pointer-events-auto">
                <button onClick={toggleMute} className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                  {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>
                {!isIOS && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = val === 0;
                      }
                      setIsMuted(val === 0);
                    }}
                    className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 h-1.5 accent-[#ED2C25] bg-white/20 rounded-full cursor-pointer appearance-none outline-none"
                  />
                )}
              </div>

              {isLiveStream ? (
                <span className="flex items-center gap-1.5 text-[#ED2C25] font-black text-[10px] uppercase bg-[#ED2C25]/10 px-2 py-0.5 rounded border border-[#ED2C25]/20 tracking-wider select-none">
                  <span className="h-1.5 w-1.5 bg-[#ED2C25] rounded-full animate-pulse" />
                  TRỰC TIẾP (LIVE)
                </span>
              ) : (
                <span className="text-white/90 text-xs md:text-sm font-medium tracking-wide">
                  {formatTime(isSeeking ? seekingTime : currentTime)} <span className="text-white/40 mx-1">/</span> {formatTime(duration)}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1 sm:w-auto sm:justify-start sm:gap-2.5 md:gap-5">
              {hasAudioVariants && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAudioMenu(value => !value);
                      setShowSettings(false);
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:h-8 sm:w-8"
                    title={selectedAudioVariant?.label || 'Âm thanh'}
                  >
                    <Mic size={20} className="group-hover/btn:scale-110 transition-transform" />
                  </button>

                  <div
                    onClick={(event) => event.stopPropagation()}
                    className={`absolute bottom-8 left-1/2 z-[90] w-[min(13.5rem,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[#ED2C25]/25 bg-[#101010]/95 text-left text-xs text-white shadow-2xl backdrop-blur-md transition-all duration-200 origin-bottom sm:bottom-10 sm:w-64 sm:text-sm ${showAudioMenu ? 'opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 translate-y-2 scale-95'}`}
                  >
                    {audioVariants.map((variant) => {
                      const selected = variant.id === selectedAudioVariant?.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            const video = videoRef.current;
                            onSelectAudioVariant?.(variant, {
                              currentTime: video?.currentTime ?? currentTime,
                              shouldPlay: video ? !video.paused : autoplay,
                              skipResumePrompt: true,
                            });
                            setShowAudioMenu(false);
                          }}
                          className={`flex w-full flex-col gap-1 px-3 py-2 transition-colors sm:px-4 sm:py-3 ${selected ? 'bg-[#ED2C25]/20 text-white ring-1 ring-inset ring-[#ED2C25]/45' : 'text-white hover:bg-white/8'}`}
                        >
                          <span className="flex w-full items-center justify-between gap-3 font-bold">
                            <span className="min-w-0 break-words text-sm sm:text-base">{variant.label}</span>
                            {selected && <Check size={16} className="shrink-0 text-[#ED2C25]" />}
                          </span>
                          {variant.detail && (
                            <span className="w-full break-words text-left text-[11px] font-semibold leading-snug text-white/75 sm:text-xs">{variant.detail}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {onNextEpisode && (
                <button type="button" onClick={onNextEpisode} className="hidden h-6 w-6 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:grid sm:h-8 sm:w-8" title="Tập tiếp">
                  <SkipForward size={20} className="group-hover/btn:scale-110 transition-transform" />
                </button>
              )}
              
              <button type="button" onClick={handleCast} className="hidden h-8 w-8 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:grid" title={isIOS || isSafariOrIOS ? 'AirPlay' : 'Chromecast'}>
                <Cast size={21} className="group-hover/btn:scale-110 transition-transform" />
              </button>

              {onCinemaMode && (
                <button onClick={onCinemaMode} className="hidden h-8 w-8 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:grid" title="Tắt đèn">
                  <LightbulbOff size={20} className="group-hover/btn:text-yellow-400 transition-colors" />
                </button>
              )}

              {isPipSupported && (
                <button onClick={togglePip} className="hidden h-8 w-8 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:grid" title="Xem hình trong hình (PiP)">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
                    <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              )}

              <button onClick={() => setShowSettings(!showSettings)} className="grid h-6 w-6 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:h-8 sm:w-8" title="Cài đặt">
                <Settings size={20} className="group-hover/btn:rotate-45 transition-transform duration-300" />
              </button>

              <button onClick={toggleFullscreen} className="grid h-6 w-6 shrink-0 place-items-center text-white/80 hover:text-white transition-colors focus:outline-none group/btn sm:h-8 sm:w-8">
                {isFullscreen ? <Minimize size={22} className="group-hover/btn:scale-90 transition-transform" /> : <Maximize size={22} className="group-hover/btn:scale-110 transition-transform" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Popover with slide animation */}
      <div className={`absolute bottom-14 right-6 bg-[#121212]/95 border border-white/10 rounded-xl p-3 w-48 text-white z-50 text-xs flex flex-col gap-2 shadow-2xl backdrop-blur-md pointer-events-auto select-none transition-all duration-300 origin-bottom-right ${showSettings ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}`}>
        <div className="font-bold border-b border-white/10 pb-1.5 text-[#ED2C25] uppercase tracking-wide">Cài đặt</div>
        
        <div className="flex flex-col gap-1">
          <span className="text-white/45 font-semibold">Tốc độ phát:</span>
          <div className="flex flex-wrap gap-1">
            {[0.5, 1, 1.25, 1.5, 2].map(speed => (
              <button
                key={speed}
                onClick={() => selectSpeed(speed)}
                className={`px-1.5 py-0.5 rounded ${playbackSpeed === speed ? 'bg-[#ED2C25] text-white font-bold' : 'bg-white/5 text-white/75 hover:bg-white/10'}`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
        
        {availableQualities.length > 0 && (
          <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-1.5">
            <span className="text-white/45 font-semibold">Chất lượng:</span>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => selectQuality('auto')}
                className={`text-left px-2 py-1 rounded transition-colors ${currentQuality === 'auto' ? 'bg-[#ED2C25] text-white font-bold' : 'hover:bg-white/5 text-white/75'}`}
              >
                Tự động (Auto)
              </button>
              {availableQualities.map(track => (
                <button
                  key={track.height}
                  onClick={() => selectQuality(track.height)}
                  className={`text-left px-2 py-1 rounded transition-colors ${currentQuality === track.height ? 'bg-[#ED2C25] text-white font-bold' : 'hover:bg-white/5 text-white/75'}`}
                >
                  {track.height}p
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
        <div 
          className="absolute bg-[#121212]/95 border border-white/10 rounded-xl py-2 w-56 text-white z-50 text-[11px] shadow-2xl backdrop-blur-md font-medium pointer-events-auto"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => { setShowCodecModal(true); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 hover:bg-[#ED2C25] hover:text-white transition-colors"
          >
            Xem thông tin Codec (Stats for Nerds)
          </button>
          <button 
            onClick={() => { setShowShortcutsModal(true); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 hover:bg-[#ED2C25] hover:text-white transition-colors"
          >
            Phím tắt điều khiển (Shortcuts)
          </button>
          
          <div className="border-t border-white/10 my-1.5" />
          
          <div className="px-4 py-0.5 text-white/40 text-[9px] font-semibold italic">
            index dev by NhanChillTV
          </div>
          <div className="px-4 py-0.5 text-white/40 text-[9px] font-semibold italic">
            Powered by ShakaPlayer
          </div>
        </div>
      )}

      {/* Codec Info Modal with slide/fade animation */}
      <div className={`absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto transition-opacity duration-300 ${showCodecModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`bg-[#121212] p-6 rounded-2xl border border-white/10 max-w-xs w-full mx-4 shadow-2xl relative select-none transition-all duration-300 transform ${showCodecModal ? 'scale-100 translate-y-0 opacity-100' : 'scale-90 translate-y-4 opacity-0'}`}>
          <h3 className="text-xs font-black text-[#ED2C25] mb-4 uppercase tracking-wide border-b border-white/10 pb-2">Thông tin Codec & Luồng</h3>
          {(() => {
            const info = getCodecInfo();
            return (
              <div className="space-y-2 text-[11px] text-white/80">
                <div><strong className="text-white/40">Trình phát:</strong> {info.type}</div>
                <div><strong className="text-white/40">Độ phân giải:</strong> {info.width}x{info.height}</div>
                <div><strong className="text-white/40">Video Codec:</strong> {info.videoCodec}</div>
                <div><strong className="text-white/40">Audio Codec:</strong> {info.audioCodec}</div>
                {info.bandwidth !== 'N/A' && <div><strong className="text-white/40">Băng thông:</strong> {info.bandwidth}</div>}
                <div><strong className="text-white/40">Khung hình giải mã:</strong> {info.decodedFrames}</div>
                <div><strong className="text-white/40">Khung hình bị rớt:</strong> {info.droppedFrames}</div>
              </div>
            );
          })()}
          <button 
            onClick={() => setShowCodecModal(false)}
            className="mt-6 w-full bg-[#ED2C25] text-white text-[11px] font-bold py-2 rounded-xl hover:bg-red-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal with slide/fade animation */}
      <div className={`absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto transition-opacity duration-300 ${showShortcutsModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`bg-[#121212] p-6 rounded-2xl border border-white/10 max-w-xs w-full mx-4 shadow-2xl relative select-none transition-all duration-300 transform ${showShortcutsModal ? 'scale-100 translate-y-0 opacity-100' : 'scale-90 translate-y-4 opacity-0'}`}>
          <h3 className="text-xs font-black text-[#ED2C25] mb-4 uppercase tracking-wide border-b border-white/10 pb-2">Phím tắt bàn phím</h3>
          <div className="space-y-2.5 text-[11px] text-white/80">
            <div className="flex justify-between"><span>Phát / Tạm dừng</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">Space / K</kbd></div>
            {!isLiveStream && (
              <>
                <div className="flex justify-between"><span>Tua nhanh 5 giây</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">Right Arrow / L</kbd></div>
                <div className="flex justify-between"><span>Tua lại 5 giây</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">Left Arrow / J</kbd></div>
              </>
            )}
            <div className="flex justify-between"><span>Tăng âm lượng 5%</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">Up Arrow</kbd></div>
            <div className="flex justify-between"><span>Giảm âm lượng 5%</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">Down Arrow</kbd></div>
            <div className="flex justify-between"><span>Bật / Tắt tiếng</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">M</kbd></div>
            <div className="flex justify-between"><span>Toàn màn hình</span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">F</kbd></div>
          </div>
          <button 
            onClick={() => setShowShortcutsModal(false)}
            className="mt-6 w-full bg-[#ED2C25] text-white text-[11px] font-bold py-2 rounded-xl hover:bg-red-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
