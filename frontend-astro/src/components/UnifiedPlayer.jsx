import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, LightbulbOff } from 'lucide-react';
import { getMimeType, inferPlaybackType } from '../lib/playbackUrl';

export default function UnifiedPlayer({
  url,
  poster,
  autoplay = true,
  muted = false,
  className = '',
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
  const uiRef = useRef(null);
  const [error, setError] = useState(null);
  
  // Custom Controls State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(initialTime > 0);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      setError('Browser không hỗ trợ Shaka Player');
      return;
    }

    const player = new shaka.Player(videoRef.current);
    playerRef.current = player;

    // Cấu hình Shaka
    player.configure({
      streaming: {
        bufferingGoal: 30,
        rebufferingGoal: 10,
        bufferBehind: 30,
      },
    });

    const loadStream = async () => {
      try {
        await player.load(url, initialTime);
        if (autoplay) {
          videoRef.current.play().catch(() => {
            console.warn('Autoplay prevented');
            setIsPlaying(false);
          });
        }
        onReady?.(player);
      } catch (err) {
        console.error('Error loading video', err);
        setError('Không thể tải luồng video: ' + err.message);
        onError?.(err);
      }
    };

    loadStream();

    player.addEventListener('error', (event) => {
      console.error('Player error', event.detail);
      setError('Lỗi phát video: ' + event.detail.message);
      onError?.(event.detail);
    });

    const video = videoRef.current;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setIsMuted(video.muted);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [url]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen?.().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const continueWatching = () => {
    setShowContinuePrompt(false);
    videoRef.current?.play();
  };

  const restartWatching = () => {
    setShowContinuePrompt(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  return (
    <div 
      ref={videoContainerRef} 
      className={`relative group bg-black overflow-hidden flex justify-center items-center ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full max-h-screen object-contain cursor-pointer"
        poster={poster}
        onClick={togglePlay}
        playsInline
      />

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg">
          {error}
        </div>
      )}

      {/* Custom Controls UI */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 flex flex-col justify-between ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Top Gradient & Title */}
        <div className="bg-gradient-to-b from-black/80 to-transparent pt-4 pb-12 px-6 flex justify-between items-start pointer-events-auto">
          <div>
            <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md">{title}</h2>
            {subTitle && <p className="text-white/80 text-sm drop-shadow-md">{subTitle}</p>}
          </div>
        </div>

        {/* Bottom Gradient & Controls */}
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-4 px-6 pointer-events-auto">
          {/* Progress Bar */}
          <div className="group/progress relative flex items-center h-4 cursor-pointer mb-2">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute w-full h-1.5 opacity-0 cursor-pointer z-20"
            />
            <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden absolute z-0 pointer-events-none">
              <div 
                className="h-full bg-[#ED2C25] transition-all duration-100 ease-linear pointer-events-none" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div 
              className="absolute h-3.5 w-3.5 bg-[#ED2C25] rounded-full z-10 pointer-events-none transform -translate-x-1/2 shadow-sm scale-0 group-hover/progress:scale-100 transition-transform"
              style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
              </button>
              
              <div className="flex items-center gap-2 group/volume relative">
                <button onClick={toggleMute} className="text-white hover:text-[#ED2C25] transition-colors focus:outline-none">
                  {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>
              </div>

              <span className="text-white/90 text-sm font-medium tracking-wide">
                {formatTime(currentTime)} <span className="text-white/40 mx-1">/</span> {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-5">
              {onNextEpisode && (
                <button onClick={onNextEpisode} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors focus:outline-none group/btn">
                  <SkipForward size={20} className="group-hover/btn:scale-110 transition-transform" />
                  <span className="text-sm font-medium hidden sm:block">Tập tiếp</span>
                </button>
              )}
              
              {onCinemaMode && (
                <button onClick={onCinemaMode} className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors focus:outline-none group/btn" title="Tắt đèn">
                  <LightbulbOff size={20} className="group-hover/btn:text-yellow-400 transition-colors" />
                </button>
              )}

              <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors focus:outline-none group/btn">
                {isFullscreen ? <Minimize size={22} className="group-hover/btn:scale-90 transition-transform" /> : <Maximize size={22} className="group-hover/btn:scale-110 transition-transform" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
