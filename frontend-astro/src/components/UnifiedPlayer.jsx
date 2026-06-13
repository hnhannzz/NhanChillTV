import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, LightbulbOff, Settings } from 'lucide-react';
import mpegts from 'mpegts.js';
import { getMimeType, inferPlaybackType } from '../lib/playbackUrl';

export default function UnifiedPlayer({
  url,
  poster,
  autoplay = true,
  muted = false,
  className = '',
  clearKey,
  isMpd,
  onNextEpisode,
  onCinemaMode,
  title,
  subTitle,
  initialTime = 0,
  onTimeUpdate,
  onReady,
  onError,
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
  const [showContinuePrompt, setShowContinuePrompt] = useState(initialTime > 0);

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
  
  // Context Menu & Custom Modals
  const [contextMenu, setContextMenu] = useState(null);
  const [showCodecModal, setShowCodecModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isLiveStream = duration === Infinity || !isFinite(duration) || subTitle === 'Live TV';

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

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsPipSupported(document.pictureInPictureEnabled || false);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    let shakaPlayer = null;
    let mpegtsPlayer = null;
    let doSeek = null;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeoutId = null;

    const lowerUrl = String(url).toLowerCase();
    const isMpegTs = !isMpd && !lowerUrl.includes('.m3u8') && !lowerUrl.includes('.mpd') && !lowerUrl.includes('.mp4');

    // 1. Block all MPD (DASH) streams on iOS/Safari (since iOS Safari lacks MSE)
    if (isMpd && isSafariOrIOS) {
      setError('Kênh/phim định dạng MPD (DASH) này chưa hỗ trợ iOS, iPadOS hoặc Safari. Vui lòng dùng Chrome/Edge trên Windows hoặc Android.');
      return;
    }

    const handleNativeError = (e) => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const mediaError = videoEl.error;
      console.warn('[Player] Native playback error:', mediaError?.code, mediaError?.message);

      if (isSafariOrIOS && !isMpd && retryCount < maxRetries) {
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

    if (isMpegTs && mpegts.isSupported()) {
      const absoluteUrl = new URL(url, window.location.href).href;

      mpegtsPlayer = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: absoluteUrl
      }, {
        enableWorker: true,
        lazyLoad: false,
        enableStashBuffer: false,
        liveBufferLatencyChasing: true,
      });
      playerRef.current = mpegtsPlayer;
      
      mpegtsPlayer.attachMediaElement(videoRef.current);
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
    } else if (isSafariOrIOS && !isMpd) {
      // 2. Dùng native HLS player cho iOS/Safari
      console.log('[Player] Using native Safari HLS/VOD engine');
      videoRef.current.src = url;
      videoRef.current.load();
      
      let seeked = false;
      doSeek = () => {
        if (seeked) return;
        if (initialTime > 0 && videoRef.current && videoRef.current.duration > 0) {
          videoRef.current.currentTime = initialTime;
          seeked = true;
          console.log('[Player] Native HLS seeked to:', initialTime);
        }
      };
      
      videoRef.current.addEventListener('loadedmetadata', doSeek);
      videoRef.current.addEventListener('loadeddata', doSeek);
      videoRef.current.addEventListener('canplay', doSeek);

      if (autoplay) {
        videoRef.current.play().catch(err => {
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
    } else {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        setError('Browser không hỗ trợ Shaka Player');
        return;
      }

      shakaPlayer = new shaka.Player(videoRef.current);
      playerRef.current = shakaPlayer;

      let clearKeysObj = {};
      if (clearKey) {
        if (typeof clearKey === 'string') {
          if (clearKey.includes(':')) {
            const [kid, key] = clearKey.split(':');
            clearKeysObj[kid] = key;
          }
        } else if (typeof clearKey === 'object') {
          clearKeysObj = clearKey;
        }
      }

      const drmConfig = Object.keys(clearKeysObj).length > 0 ? {
        clearKeys: clearKeysObj
      } : undefined;

      shakaPlayer.configure({
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
          }
        },
        drm: drmConfig
      });

      const loadStream = async () => {
        try {
          await shakaPlayer.load(url, initialTime);
          if (autoplay) {
            videoRef.current.play().catch(() => {
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
          console.error('Error loading video', err);
          setError('Không thể tải luồng video: ' + err.message);
          onError?.(err);
        }
      };

      loadStream();

      shakaPlayer.addEventListener('error', (event) => {
        console.error('Player error', event.detail);
        setError('Lỗi phát video: ' + event.detail.message);
        onError?.(event.detail);
      });
    }

    const video = videoRef.current;
    
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

    // Sync fullscreen state with native iOS player controls
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

    return () => {
      if (shakaPlayer) {
        shakaPlayer.destroy();
      }
      if (mpegtsPlayer) {
        mpegtsPlayer.destroy();
      }

      // Stop source load and clean memory on iOS/Safari
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
  }, [url]);

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
    videoRef.current?.play().catch(() => {});
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
          "webkit-playsinline": "true"
        }}
      />

      {/* Click/Touch Overlay */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer"
        onTouchEnd={(e) => {
          e.preventDefault();
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
            className="pointer-events-auto flex items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-full bg-black/50 border border-white/20 text-white hover:bg-[#ED2C25] hover:border-[#ED2C25] hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md shadow-2xl"
          >
            {isPlaying ? (
              <Pause fill="currentColor" size={28} className="md:h-8 md:w-8" />
            ) : (
              <Play fill="currentColor" size={28} className="translate-x-0.5 md:h-8 md:w-8" />
            )}
          </button>
        </div>
      )}

      {/* Continue Watching Prompt */}
      {showContinuePrompt && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
          <div className="bg-[#121212] p-8 rounded-2xl border border-white/10 text-center shadow-2xl max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">THÔNG BÁO!</h3>
            <p className="text-white/70 mb-6">Bạn đã dừng lại ở {formatTime(initialTime)}</p>
            <div className="flex flex-col gap-3">
              <button onClick={continueWatching} className="w-full bg-[#ED2C25] text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors">
                Tiếp tục xem
              </button>
              <button onClick={restartWatching} className="w-full bg-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition-colors">
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
        className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 flex flex-col justify-between ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Top Gradient & Title */}
        <div className="bg-gradient-to-b from-black/80 to-transparent pt-4 pb-12 px-6 flex justify-between items-start pointer-events-auto">
          <div>
            <h2 className="text-white font-bold text-base md:text-xl drop-shadow-md">{title}</h2>
            {subTitle && <p className="text-white/80 text-xs md:text-sm drop-shadow-md">{subTitle}</p>}
          </div>
        </div>

        {/* Bottom Gradient & Controls */}
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 md:pb-4 px-3 md:px-6 pointer-events-auto">
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
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

            <div className="flex items-center gap-2.5 md:gap-5">
              {onNextEpisode && (
                <button onClick={onNextEpisode} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors focus:outline-none group/btn">
                  <SkipForward size={20} className="group-hover/btn:scale-110 transition-transform" />
                  <span className="text-sm font-medium hidden sm:block">Tập tiếp</span>
                </button>
              )}
              
              {onCinemaMode && (
                <button onClick={onCinemaMode} className="hidden sm:flex items-center gap-1.5 text-white/80 hover:text-white transition-colors focus:outline-none group/btn" title="Tắt đèn">
                  <LightbulbOff size={20} className="group-hover/btn:text-yellow-400 transition-colors" />
                </button>
              )}

              {isPipSupported && (
                <button onClick={togglePip} className="text-white/80 hover:text-white transition-colors focus:outline-none group/btn" title="Xem hình trong hình (PiP)">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
                    <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              )}

              <button onClick={() => setShowSettings(!showSettings)} className="text-white/80 hover:text-white transition-colors focus:outline-none group/btn" title="Cài đặt">
                <Settings size={20} className="group-hover/btn:rotate-45 transition-transform duration-300" />
              </button>

              <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors focus:outline-none group/btn">
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
