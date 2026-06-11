import React, { useState, useEffect } from 'react';
import { Heart, Play, Send } from 'lucide-react';
import { fetchNguoncJson } from '../lib/nguoncApi';
import MovieStreamPlayer from './MovieStreamPlayer';

export default function MovieDetailContainer() {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentEmbed, setCurrentEmbed] = useState('');
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentEpName, setCurrentEpName] = useState('');
  
  const [isFavorite, setIsFavorite] = useState(false);
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('slug') : null;

  useEffect(() => {
    if (!slug) {
      setError('Không tìm thấy mã phim');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const data = await fetchNguoncJson(`/film/${slug}`);
        if (data.status === 'success') {
          const m = data.movie || data.item;
          setMovie(m);
          
          if (m.episodes && m.episodes[0] && m.episodes[0].items[0]) {
            const firstEpisode = m.episodes[0].items[0];
            setCurrentEpisode(firstEpisode);
            setCurrentEmbed(firstEpisode.embed || '');
            setCurrentEpName(firstEpisode.name);
          }

          // Check favorite
          const token = localStorage.getItem('userToken');
          if (token) {
            const favRes = await fetch('/api/user/favorites', {
              headers: { 'x-user-id': token }
            });
            const favData = await favRes.json();
            if (favData.success && favData.data.movies.find(x => x.slug === slug)) {
              setIsFavorite(true);
            }
          }

          loadComments();
        } else {
          setError('Không tìm thấy thông tin phim');
        }
      } catch (err) {
        setError('Lỗi kết nối máy chủ phim');
      }
      setLoading(false);
    };

    loadData();
  }, [slug]);

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/comments/${slug}`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      alert('Vui lòng đăng nhập để thêm vào yêu thích!');
      return;
    }

    try {
      const res = await fetch('/api/user/favorites/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token
        },
        body: JSON.stringify({
          type: 'movies',
          itemId: slug,
          itemData: {
            slug: movie.slug,
            name: movie.name,
            thumb_url: movie.thumb_url,
            quality: movie.quality,
            year: movie.year
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsFavorite(!isFavorite);
      }
    } catch (e) {
      alert('Có lỗi xảy ra khi lưu yêu thích');
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem('userToken');
    const username = localStorage.getItem('userName');
    
    if (!token || !username) {
      alert('Vui lòng đăng nhập để bình luận!');
      return;
    }

    try {
      const res = await fetch(`/api/comments/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token
        },
        body: JSON.stringify({ content: newComment, username })
      });
      const data = await res.json();
      if (data.success) {
        setComments(current => [data.data, ...current]);
        setNewComment('');
        document.activeElement?.blur();
      } else {
        alert(data.error || 'Lỗi gửi bình luận');
      }
    } catch (e) {
      alert('Lỗi mạng');
    }
  };

  if (loading) return <div className="text-center py-20 text-white/50 animate-pulse">Đang tải thông tin phim...</div>;
  if (error) return <div className="text-center py-20 text-red-500 font-bold">{error}</div>;
  if (!movie) return null;

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto px-4 md:px-0">
      
      {/* 1. Movie Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <img src={movie.thumb_url || movie.poster_url} alt={movie.name} className="w-[150px] md:w-[200px] object-cover rounded-xl border border-white/10 shadow-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#ED2C25] text-white text-[10px] font-bold px-2 py-1 rounded">{movie.quality || 'HD'}</span>
            <span className="bg-white/10 text-white/70 text-[10px] font-bold px-2 py-1 rounded">{movie.year || '2026'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{movie.name}</h1>
          <h2 className="text-lg text-white/50 mb-4">{movie.original_name}</h2>
          
          <div className="grid grid-cols-2 md:flex md:gap-8 gap-y-2 text-sm text-white/70 mb-6">
            <div><strong>Trạng thái:</strong> {movie.current_episode}</div>
            <div><strong>Ngôn ngữ:</strong> {movie.language}</div>
            <div className="col-span-2 md:col-span-1"><strong>Thời lượng:</strong> {movie.time}</div>
          </div>

          <button 
            onClick={handleToggleFavorite}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${isFavorite ? 'bg-pink-500/20 text-pink-500 hover:bg-pink-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'Đã yêu thích' : 'Thêm yêu thích'}
          </button>
        </div>
      </div>

      {/* 2. Player Section (Centered, Prominent) */}
      <div className="movie-player-shell w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 relative mx-auto">
        {currentEpisode ? (
          <div className="aspect-video w-full bg-[#0A0A0A]">
            <MovieStreamPlayer episode={currentEpisode} />
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center text-white/50 bg-[#121212]">
            Phim chưa có tập nào được cập nhật
          </div>
        )}
      </div>

      {/* 3. Episodes and Comments (Side-by-side on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Left Side: Episodes & Description */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#121212] rounded-xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Danh Sách Tập</h3>
            {(movie.episodes || []).map((server, sIdx) => (
              <div key={sIdx} className="mb-4 last:mb-0">
                <h4 className="text-sm font-semibold text-white/50 mb-2">{server.server_name}</h4>
                <div className="flex flex-wrap gap-2">
                  {server.items.map((ep, eIdx) => (
                    <button 
                      key={eIdx}
                      onClick={() => {
                        setCurrentEpisode(ep);
                        setCurrentEmbed(ep.embed || '');
                        setCurrentEpName(ep.name);
                        document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentEmbed === (ep.embed || '') ? 'bg-[#ED2C25] text-white shadow-lg' : 'bg-[#1A1A1A] text-white/70 hover:bg-white/20'}`}
                    >
                      {ep.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#121212] rounded-xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-3">Nội Dung Phim</h3>
            <div className="text-sm text-white/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: movie.description }} />
          </div>
        </div>

        {/* Right Side: Comments */}
        <div className="bg-[#121212] rounded-xl p-4 md:p-6 border border-white/5 flex flex-col h-full max-h-[800px] md:sticky md:top-24">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-4">Bình Luận ({comments.length})</h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar">
            {comments.length === 0 ? (
              <div className="text-center text-white/40 text-sm py-10">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-[#1A1A1A] p-3 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[#ED2C25]">{c.username}</span>
                    <span className="text-[10px] text-white/40">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <p className="text-sm text-white/90 break-words">{c.content}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmitComment} className="mt-auto relative">
            <input 
              type="text" 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Nhập bình luận của bạn..."
              className="comment-input w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-base text-white focus:outline-none focus:border-[#ED2C25] transition-colors"
            />
            <button 
              type="submit" 
              disabled={!newComment.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#ED2C25] text-white rounded-lg disabled:opacity-50 disabled:bg-white/10 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
