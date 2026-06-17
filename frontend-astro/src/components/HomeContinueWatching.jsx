import React, { useEffect, useState } from 'react';
import { Clock3, Play } from 'lucide-react';
import { getOPhimImageUrl } from '../lib/OPhimApi';

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) return `${hrs}g ${mins}p`;
  return `${mins || 1}p`;
}

export default function HomeContinueWatching() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const userId = localStorage.getItem('userToken') || 'guest';
    const key = `movie_continue_${userId}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      setItems(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
    } catch {
      setItems([]);
    }
  }, []);

  if (!items.length) return null;

  return (
    <div className="overflow-hidden">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white md:text-3xl">Xem tiếp</h2>
          <p className="mt-1 text-sm text-white/45">Xem tiếp tập phim bạn đang xem dở.</p>
        </div>
        <a href="/movies/" className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/15 hover:text-white">Kho phim</a>
      </div>
      <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
        {items.map(item => (
          <a key={`${item.slug}-${item.episodeKey}`} href={`/movie-detail/?slug=${encodeURIComponent(item.slug)}&episode=${encodeURIComponent(item.episodeKey || '')}`} className="group flex w-[230px] shrink-0 gap-3 rounded-lg border border-white/8 bg-[#141414] p-2 hover:border-[#ED2C25]/50">
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-black">
              <img src={getOPhimImageUrl(item.thumb_url)} alt={item.name} className="h-full w-full object-cover" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"><Play size={18} fill="currentColor" className="text-white" /></span>
            </div>
            <div className="min-w-0 flex-1 py-1">
              <div className="line-clamp-2 text-sm font-bold text-white group-hover:text-[#ED2C25]">{item.name}</div>
              <div className="mt-1 truncate text-xs text-white/45">{item.episodeName || 'Tập phim'}</div>
              <div className="mt-3 inline-flex items-center gap-1 rounded bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/60"><Clock3 size={12} /> {formatTime(item.currentTime)}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
