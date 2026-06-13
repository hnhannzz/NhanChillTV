import React, { useState, useEffect, useRef } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { fetchOPhimJson, getOPhimItems, getOPhimImageUrl } from '../lib/OPhimApi';

export default function HomeMovies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useDraggableScroll();

  const fetchMovies = () => {
    setLoading(true);
    setError(null);
    fetchOPhimJson('/films/phim-moi-cap-nhat')
      .then(data => {
        setMovies(getOPhimItems(data).slice(0, 12));
      })
      .catch(err => {
        console.error(err);
        setError('Không thể tải danh sách phim');
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchMovies, []);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-hidden">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="min-w-[150px] md:min-w-[200px] aspect-[2/3] bg-white/5 rounded-xl animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-[#1A1A1A] rounded-xl border border-white/5">
        <p className="text-white/50 text-sm mb-3">{error}</p>
        <button onClick={fetchMovies} className="px-4 py-2 bg-[#ED2C25] text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
          Thử lại
        </button>
      </div>
    );
  }

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -600, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 600, behavior: 'smooth' });
  };

  return (
    <div className="relative group/nav">
      {/* Left Arrow */}
      <button 
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-24 bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover/nav:opacity-100 transition-opacity backdrop-blur-sm hidden md:flex"
      >
        <ChevronLeft size={32} />
      </button>

      <div 
        ref={scrollRef}
        className="mobile-horizontal-scroll flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-proximity cursor-grab py-2 select-none px-4 md:snap-mandatory md:px-0"
        onDragStart={(e) => e.preventDefault()}
      >
        {movies.map(movie => (
        <a key={movie.slug} href={`/movie-detail?slug=${movie.slug}`} className="group cursor-pointer flex-none w-[140px] md:w-[180px] snap-start" draggable="false">
          <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1A1A1A] mb-3 border border-white/5 group-hover:border-[#ED2C25]/50 transition-colors">
            <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" draggable="false" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <div className="w-10 h-10 rounded-full bg-[#ED2C25] flex items-center justify-center text-white translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg shadow-red-500/50">
                <Play size={16} fill="currentColor" className="ml-1" />
              </div>
            </div>
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-[10px] font-bold text-[#ED2C25] border border-[#ED2C25]/50 rounded">
              {movie.quality || movie.time || 'HD'}
            </div>
          </div>
          <h3 className="font-semibold text-sm text-white/90 group-hover:text-[#ED2C25] transition-colors truncate">{movie.name}</h3>
          <p className="text-xs text-white/50 mt-1 truncate">{movie.original_name || movie.year}</p>
        </a>
      ))}
      </div>

      {/* Right Arrow */}
      <button 
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-24 bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover/nav:opacity-100 transition-opacity backdrop-blur-sm hidden md:flex"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
}
