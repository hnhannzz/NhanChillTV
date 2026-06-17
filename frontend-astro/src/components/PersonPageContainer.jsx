import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Clapperboard, Film, Search, UserRound } from 'lucide-react';
import { fetchOPhimJson, getOPhimImageUrl, getOPhimItems } from '../lib/OPhimApi';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePeople(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function peopleIncludes(list, name) {
  const target = normalizeText(name);
  return normalizePeople(list).some(item => normalizeText(item) === target || normalizeText(item).includes(target));
}

function getMovieDetail(data) {
  return data?.movie || data?.item || data?.data?.item || null;
}

export default function PersonPageContainer() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const personName = params.get('name') || '';
  const initialType = params.get('type') === 'director' ? 'director' : 'actor';
  const [activeTab, setActiveTab] = useState(initialType);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!personName.trim()) {
      setError('Thiếu tên diễn viên hoặc đạo diễn.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadPerson() {
      setLoading(true);
      setError('');
      try {
        const searchData = await fetchOPhimJson(`/films/search?keyword=${encodeURIComponent(personName)}&page=1`);
        const searchItems = getOPhimItems(searchData).slice(0, 12);
        const details = await Promise.allSettled(
          searchItems
            .filter(item => item.slug)
            .map(async item => {
              const detailData = await fetchOPhimJson(`/phim/${item.slug}`);
              return getMovieDetail(detailData) || item;
            })
        );

        const hydrated = details
          .filter(result => result.status === 'fulfilled')
          .map(result => {
            const movie = result.value;
            return {
              ...movie,
              actorHit: peopleIncludes(movie.actor || movie.casts, personName),
              directorHit: peopleIncludes(movie.director, personName),
            };
          });

        const directMatches = hydrated.filter(movie => movie.actorHit || movie.directorHit);
        if (!cancelled) setItems(directMatches.length ? directMatches : hydrated);
      } catch (err) {
        if (!cancelled) setError('Không tải được dữ liệu từ OPhim lúc này.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPerson();
    return () => { cancelled = true; };
  }, [personName]);

  const actorMovies = useMemo(() => items.filter(movie => movie.actorHit), [items]);
  const directorMovies = useMemo(() => items.filter(movie => movie.directorHit), [items]);
  const relatedMovies = useMemo(() => {
    if (activeTab === 'actor') return actorMovies.length ? actorMovies : items;
    if (activeTab === 'director') return directorMovies.length ? directorMovies : items;
    return items;
  }, [activeTab, actorMovies, directorMovies, items]);
  const images = useMemo(() => items.filter(movie => movie.thumb_url || movie.poster_url).slice(0, 12), [items]);
  const initials = personName.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase() || '?';

  const tabs = [
    { id: 'actor', label: 'Đã đóng', count: actorMovies.length, icon: Clapperboard },
    { id: 'director', label: 'Đạo diễn', count: directorMovies.length, icon: Film },
    { id: 'images', label: 'Hình ảnh', count: images.length, icon: Camera },
  ];

  if (loading) return <div className="py-20 text-center text-white/50 animate-pulse">Đang tải hồ sơ...</div>;
  if (error) return <div className="py-20 text-center font-bold text-red-300">{error}</div>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 md:px-0">
      <section className="flex flex-col gap-5 rounded-lg border border-white/8 bg-[#111111] p-5 md:flex-row md:items-end md:p-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl font-black text-white md:h-28 md:w-28">
          {initials || <UserRound size={36} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-[#ED2C25]/25 bg-[#ED2C25]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#ED2C25]">
            <UserRound size={14} />
            OPhim Person
          </div>
          <h1 className="break-words text-3xl font-black text-white md:text-5xl">{personName}</h1>
          <p className="mt-2 text-sm text-white/50">
            Tìm thấy {actorMovies.length} phim đã đóng và {directorMovies.length} phim đạo diễn từ metadata OPhim.
          </p>
        </div>
        <a href={`/movies/?search=${encodeURIComponent(personName)}`} className="inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
          <Search size={16} />
          Tìm thêm
        </a>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-[#ED2C25] text-white' : 'bg-white/8 text-white/65 hover:bg-white/12 hover:text-white'}`}
            >
              <Icon size={16} />
              {tab.label}
              <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'images' ? (
        images.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {images.map(movie => (
              <a key={movie.slug || movie._id || movie.name} href={`/movie-detail/?slug=${encodeURIComponent(movie.slug)}`} className="group overflow-hidden rounded-lg border border-white/8 bg-[#151515]">
                <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="p-2 text-xs font-semibold text-white/75 line-clamp-2">{movie.name}</div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyPersonState text="Chưa có hình ảnh phù hợp từ OPhim." />
        )
      ) : relatedMovies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {relatedMovies.map(movie => (
            <a key={movie.slug || movie._id || movie.name} href={`/movie-detail/?slug=${encodeURIComponent(movie.slug)}`} className="group min-w-0">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/8 bg-[#151515]">
                <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
                <span className="absolute right-1.5 top-1.5 rounded bg-[#ED2C25] px-1.5 py-0.5 text-[9px] font-bold text-white">{movie.quality || movie.episode_current || 'HD'}</span>
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-bold text-white group-hover:text-[#ED2C25]">{movie.name}</div>
              {movie.origin_name || movie.original_name ? <div className="line-clamp-1 text-xs text-white/40">{movie.origin_name || movie.original_name}</div> : null}
            </a>
          ))}
        </div>
      ) : (
        <EmptyPersonState text="Chưa tìm thấy phim phù hợp trong metadata OPhim." />
      )}
    </div>
  );
}

function EmptyPersonState({ text }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#111111] px-5 py-12 text-center text-sm text-white/45">
      {text}
    </div>
  );
}
