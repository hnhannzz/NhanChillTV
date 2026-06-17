import React, { useEffect, useState } from 'react';
import { Bell, Heart, Play } from 'lucide-react';
import { fetchOPhimJson, getOPhimImageUrl } from '../lib/OPhimApi';

export default function HomeFavoriteUpdates() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (!token) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/user/favorites', { headers: { 'x-user-id': token } });
        const data = await response.json();
        const favorites = data.success ? (data.data.movies || []).slice(0, 8) : [];
        const details = await Promise.allSettled(favorites.map(async favorite => {
          let detail = null;
          try {
            detail = await fetchOPhimJson(`/phim/${favorite.slug}`);
          } catch {
            if (favorite.name) {
              const search = await fetchOPhimJson(`/films/search?keyword=${encodeURIComponent(favorite.name)}&page=1&limit=1`);
              const match = search.items?.[0] || search.data?.items?.[0] || null;
              if (match?.slug) detail = await fetchOPhimJson(`/phim/${match.slug}`);
            }
          }
          const movie = detail?.movie || detail?.item || detail?.data?.item;
          if (!movie) return null;
          const currentEpisode = movie.episode_current || movie.current_episode || '';
          const previousEpisode = favorite.episode_current || favorite.current_episode || '';
          const hasNewEpisode = previousEpisode && currentEpisode && currentEpisode !== previousEpisode;
          return {
            ...favorite,
            ...movie,
            hasNewEpisode,
            previousEpisode,
            currentEpisode,
          };
        }));
        if (cancelled) return;
        const next = details
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value)
          .sort((a, b) => Number(b.hasNewEpisode) - Number(a.hasNewEpisode))
          .slice(0, 8);
        setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (!items.length) return null;

  return (
    <div className="overflow-hidden">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-xl font-black text-white md:text-3xl"><Heart size={22} className="text-[#ED2C25]" /> Phim yêu thích</h2>
          <p className="mt-1 text-sm text-white/45">Theo dõi tập mới từ danh sách yêu thích của bạn.</p>
        </div>
        <a href="/movies/" className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/15 hover:text-white">Quản lý</a>
      </div>
      <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
        {items.map(movie => (
          <a key={movie.slug} href={`/movie-detail/?slug=${encodeURIComponent(movie.slug)}`} className="group w-[150px] shrink-0 md:w-[180px]">
            <div className="relative mb-3 aspect-[2/3] overflow-hidden rounded-lg border border-white/8 bg-[#141414] group-hover:border-[#ED2C25]/50">
              <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"><Play size={20} fill="currentColor" className="text-white" /></div>
              {movie.hasNewEpisode && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-black text-white"><Bell size={11} /> Tập mới</span>}
              <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 py-1 text-[10px] font-bold text-white">{movie.currentEpisode || movie.episode_current || 'HD'}</span>
            </div>
            <h3 className="truncate text-sm font-bold text-white/90 group-hover:text-[#ED2C25]">{movie.name}</h3>
            <p className="mt-1 truncate text-xs text-white/45">{movie.origin_name || movie.original_name || movie.year}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
