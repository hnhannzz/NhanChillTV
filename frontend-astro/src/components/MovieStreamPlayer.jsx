import React, { Suspense, lazy, useEffect, useState } from 'react';

const UnifiedPlayer = lazy(() => import('./UnifiedPlayer.jsx'));
const LegacyPlayer = lazy(() => import('./LegacyPlayer.jsx'));

export default function MovieStreamPlayer({ episode, movie, movieSlug, onNextEpisode, onCinemaMode }) {
  // Ưu tiên m3u8 từ OPhim, nếu không có fallback sang embed
  const streamUrl = episode?.link_m3u8 || episode?.link_hls || '';
  const embedUrl = episode?.link_embed || episode?.embed || '';
  
  const resolvedMovieSlug = movieSlug || movie?.slug || movie?._id || movie?.id || 'unknown-movie';
  const resolvedEpisodeKey = episode?.slug || episode?.filename || episode?.name || episode?.link_m3u8 || episode?.link_embed || 'unknown-episode';
  const [progressKey, setProgressKey] = useState('');
  const [initialTime, setInitialTime] = useState(0);
  const [playerType, setPlayerType] = useState('shaka');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('userToken') || 'guest';
      const key = `movie_progress_${userId}_${resolvedMovieSlug}_${resolvedEpisodeKey}`;
      setProgressKey(key);
      const savedTime = localStorage.getItem(key);
      setInitialTime(savedTime ? parseFloat(savedTime) || 0 : 0);
      
      fetch('/api/admin/system/status')
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.data) {
            setPlayerType(data.data.playerType || 'shaka');
          }
        })
        .catch(err => console.error('Failed to load system settings:', err));
    }
  }, [resolvedMovieSlug, resolvedEpisodeKey]);

  const handleTimeUpdate = (currentTime) => {
    if (currentTime > 5 && progressKey && typeof window !== 'undefined') {
      localStorage.setItem(progressKey, currentTime.toString());
      const userId = localStorage.getItem('userToken') || 'guest';
      const listKey = `movie_continue_${userId}`;
      let existing = [];
      try {
        existing = JSON.parse(localStorage.getItem(listKey) || '[]');
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }
      const nextItem = {
        slug: resolvedMovieSlug,
        name: movie?.name || 'Phim',
        thumb_url: movie?.thumb_url || movie?.poster_url || '',
        episodeName: episode?.name || '',
        episodeKey: resolvedEpisodeKey,
        currentTime,
        updatedAt: Date.now(),
      };
      const next = [nextItem, ...existing.filter(item => !(item.slug === nextItem.slug && item.episodeKey === nextItem.episodeKey))].slice(0, 30);
      localStorage.setItem(listKey, JSON.stringify(next));
    }
  };

  if (streamUrl) {
    const PlayerComponent = playerType === 'legacy' ? LegacyPlayer : UnifiedPlayer;
    return (
      <Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-black text-sm font-semibold text-white/55">Đang tải trình phát...</div>}>
        <PlayerComponent
          key={`${streamUrl}_${playerType}_${progressKey}_${initialTime}`}
          url={streamUrl}
          initialTime={initialTime}
          onTimeUpdate={handleTimeUpdate}
          onNextEpisode={onNextEpisode}
          onCinemaMode={onCinemaMode}
          title={movie?.name || 'Phim'}
          subTitle={episode?.name || 'Tập phim'}
          autoplay={true}
          className="w-full h-full"
        />
      </Suspense>
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
