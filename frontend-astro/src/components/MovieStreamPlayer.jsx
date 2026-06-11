import React from 'react';

export default function MovieStreamPlayer({ episode }) {
  const embedUrl = String(episode?.embed || '').trim();

  if (embedUrl) {
    return (
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={episode?.name || 'Nguonc embed player'}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        loading="eager"
        referrerPolicy="origin-when-cross-origin"
        className="movie-player-frame h-full w-full border-none bg-black"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#121212] px-4 text-center text-white/50">
      Nguồn embed của tập này chưa khả dụng.
    </div>
  );
}
