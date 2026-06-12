import React, { useEffect, useState } from 'react';
import UnifiedPlayer from './UnifiedPlayer';

export default function MovieStreamPlayer({ episode, movieSlug, onNextEpisode, onCinemaMode }) {
  // Ưu tiên m3u8 từ OPhim, nếu không có fallback sang embed
  const streamUrl = episode?.link_m3u8 || episode?.link_hls || '';
  const embedUrl = episode?.link_embed || episode?.embed || '';
  
  const progressKey = `progress_${movieSlug}_${episode?.slug || episode?.name}`;
  const [initialTime, setInitialTime] = useState(0);
  const [proxiedUrl, setProxiedUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (streamUrl) {
      fetch(`/api/proxy/resolve?url=${encodeURIComponent(streamUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (isMounted && data.success && data.url) {
            setProxiedUrl(data.url);
          } else if (isMounted) {
            setProxiedUrl(streamUrl);
          }
        })
        .catch(() => {
          if (isMounted) setProxiedUrl(streamUrl);
        });
    } else {
      setProxiedUrl('');
    }
    return () => { isMounted = false; };
  }, [streamUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(progressKey);
      if (saved) {
        setInitialTime(parseFloat(saved));
      }
    }
  }, [progressKey]);

  const handleTimeUpdate = (currentTime) => {
    if (currentTime > 5 && typeof window !== 'undefined') {
      localStorage.setItem(progressKey, currentTime.toString());
    }
  };

  if (streamUrl) {
    if (!proxiedUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center text-white/50 bg-[#121212] px-4 text-center">
          <div className="animate-pulse">Đang tải luồng phim...</div>
        </div>
      );
    }
    return (
      <UnifiedPlayer
        key={proxiedUrl}
        url={proxiedUrl}
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
