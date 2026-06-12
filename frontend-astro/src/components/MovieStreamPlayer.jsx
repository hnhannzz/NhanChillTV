import React from 'react';

export default function MovieStreamPlayer({ episode }) {
  const embedUrl = episode?.embed || episode?.link_embed || '';

  if (embedUrl) {
    return (
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={episode?.name || 'Nguonc embed player'}
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
      Nguon embed cua tap nay chua kha dung.
    </div>
  );
}
