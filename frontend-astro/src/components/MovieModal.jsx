import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import { fetchOPhimJson, getOPhimImageUrl } from '../lib/OPhimApi';

export default function MovieModal({ slug, onClose }) {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchOPhimJson(`/phim/${slug}`)
      .then(data => {
        const m = data.movie || data.item || data.data?.item;
        if (m) {
          setMovie(m);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (!slug) return null;

  const renderPeopleLinks = (people, type) => {
    const list = Array.isArray(people)
      ? people
      : String(people || '').split(',').map(item => item.trim()).filter(Boolean);
    if (!list.length) return 'Đang cập nhật';
    return (
      <span className="inline-flex flex-wrap gap-1.5 align-middle">
        {list.map(person => (
          <a
            key={`${type}-${person}`}
            href={`/person/?type=${type}&name=${encodeURIComponent(person)}`}
            className="rounded-md bg-white/8 px-2 py-0.5 text-xs font-semibold text-white hover:bg-[#ED2C25]"
          >
            {person}
          </a>
        ))}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121212] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto hide-scrollbar border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="h-[400px] flex items-center justify-center text-white/50 animate-pulse">
            Đang tải thông tin phim...
          </div>
        ) : movie ? (
          <div className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
            <div className="w-full md:w-1/3 shrink-0">
              <img 
                src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} 
                alt={movie.name} 
                className="w-full rounded-xl shadow-lg border border-white/10"
              />
              <button 
                onClick={() => window.location.href = `/movie-detail?slug=${movie.slug}`}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-[#ED2C25] hover:bg-red-700 transition-colors rounded-xl text-white font-bold"
              >
                <Play fill="currentColor" size={20} />
                Xem Phim Ngay
              </button>
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl font-black text-white">{movie.name}</h2>
                <h3 className="text-lg text-white/50 mt-1">{movie.original_name}</h3>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-[#ED2C25]/20 text-[#ED2C25] text-xs font-bold rounded">{movie.quality || 'HD'}</span>
                <span className="px-2 py-1 bg-white/10 text-white/70 text-xs font-bold rounded">{movie.year || 'N/A'}</span>
                <span className="px-2 py-1 bg-white/10 text-white/70 text-xs font-bold rounded">{movie.time || 'N/A'}</span>
                <span className="px-2 py-1 bg-white/10 text-white/70 text-xs font-bold rounded">{movie.episode_current || movie.current_episode || 'Full'}</span>
              </div>

              <div className="text-sm text-white/80 space-y-2">
                <p><strong>Đạo diễn:</strong> {renderPeopleLinks(movie.director, 'director')}</p>
                <p><strong>Diễn viên:</strong> {renderPeopleLinks(movie.actor || movie.casts, 'actor')}</p>
                <p><strong>Điểm:</strong> {movie.tmdb?.vote_average ? `TMDB ${movie.tmdb.vote_average}` : (movie.imdb?.vote_average ? `IMDB ${movie.imdb.vote_average}` : 'Chưa có')}</p>
                <p><strong>Thể loại:</strong> {movie.category && movie.category[1] ? movie.category[1].list.map(c => c.name).join(', ') : 'Đang cập nhật'}</p>
                <p><strong>Quốc gia:</strong> {movie.category && movie.category[4] ? movie.category[4].list.map(c => c.name).join(', ') : 'Đang cập nhật'}</p>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-bold text-white mb-2">Nội Dung Phim</h4>
                <div 
                  className="text-sm text-white/60 leading-relaxed max-h-32 overflow-y-auto hide-scrollbar" 
                  dangerouslySetInnerHTML={{ __html: movie.content || movie.description }} 
                />
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-bold text-white mb-2">Danh sách tập</h4>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto hide-scrollbar">
                  {(movie.episodes?.[0]?.server_data || movie.episodes?.[0]?.items || []).map(ep => (
                    <a 
                      key={ep.name}
                      href={`/movie-detail?slug=${movie.slug}`}
                      className="px-3 py-1.5 bg-white/5 hover:bg-[#ED2C25] text-white/70 hover:text-white transition-colors rounded border border-white/10 text-sm"
                    >
                      {ep.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-red-500 font-bold">
            Không tìm thấy thông tin phim
          </div>
        )}
      </div>
    </div>
  );
}
