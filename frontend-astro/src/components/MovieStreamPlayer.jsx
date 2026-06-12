import React, { useEffect, useState } from 'react';
import UnifiedPlayer from './UnifiedPlayer';
import LegacyPlayer from './LegacyPlayer';

export default function MovieStreamPlayer({ episode, movieSlug, onNextEpisode, onCinemaMode }) {
  // Ưu tiên m3u8 từ OPhim, nếu không có fallback sang embed
  const streamUrl = episode?.link_m3u8 || episode?.link_hls || '';
  const embedUrl = episode?.link_embed || episode?.embed || '';
  
  const progressKey = `progress_${movieSlug}_${episode?.slug || episode?.name}`;
  const [initialTime, setInitialTime] = useState(0);
  const [playerType, setPlayerType] = useState('shaka');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTime = localStorage.getItem(progressKey);
      if (savedTime) setInitialTime(parseFloat(savedTime));
      
      fetch('/api/admin/system/status')
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.data) {
            setPlayerType(data.data.playerType || 'shaka');
          }
        })
        .catch(err => console.error('Failed to load system settings:', err));
    }
  }, [progressKey]);

  const handleTimeUpdate = (currentTime) => {
    if (currentTime > 5 && typeof window !== 'undefined') {
      localStorage.setItem(progressKey, currentTime.toString());
    }
  };

  if (streamUrl) {
    const PlayerComponent = playerType === 'legacy' ? LegacyPlayer : UnifiedPlayer;
    return (
      <PlayerComponent
        key={`${streamUrl}_${playerType}`}
        url={streamUrl}
        initialTime={initialTime}
        onTimeUpdate={handleTimeUpdate}
        onNextEpisode={onNextEpisode}
        onCinemaMode={onCinemaMode}
        title={episode?.name || 'Tập phim'}
        autoplay={true}
        className="w-full h-full"
      />
    );
  }

  if (embedUrl) {
    return (
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={episode?.name || 'Embed player'}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; playsinline"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups"
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full border-none bg-black"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-white/50 bg-[#121212] px-4 text-center">
      Nguồn phát của tập này chưa khả dụng.
    </div>
  );
}
