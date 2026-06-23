import React, { useState, useEffect } from 'react';
import { Heart, Play, Send } from 'lucide-react';
import { fetchOPhimJson, getOPhimImageUrl, getOPhimItems } from '../lib/OPhimApi';
import MovieStreamPlayer from './MovieStreamPlayer';

const getEpisodeList = (server) => {
  const list = server?.server_data || server?.items || [];
  return Array.isArray(list) ? list : [];
};

const getEpisodeKey = (episode) => (
  episode?.slug ||
  episode?.filename ||
  episode?.name ||
  episode?.link_m3u8 ||
  episode?.link_hls ||
  episode?.link_embed ||
  episode?.embed ||
  ''
);

const getEpisodeEmbed = (episode) => (
  episode?.link_m3u8 ||
  episode?.link_hls ||
  episode?.link_embed ||
  episode?.embed ||
  ''
);

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const inferAudioLabel = (serverName = '', movieLang = '') => {
  const text = normalizeText(`${serverName} ${movieLang}`);
  if (text.includes('long tieng') || text.includes('longtieng')) return 'Lồng tiếng';
  if (text.includes('thuyet minh') || text.includes('thuyetminh')) return 'Thuyết minh';
  return 'Vietsub';
};

const getEpisodeOptions = (movie) => (movie?.episodes || []).flatMap((server, serverIndex) =>
  getEpisodeList(server).map((episode, episodeIndex) => ({
    server,
    serverIndex,
    episode,
    episodeIndex,
    key: getEpisodeKey(episode),
    embed: getEpisodeEmbed(episode),
  }))
);

const getNextEpisodeOption = (movie, serverIndex, episodeIndex) => {
  const server = movie?.episodes?.[serverIndex];
  const episodes = getEpisodeList(server);
  const nextIndex = episodeIndex + 1;
  const episode = episodes[nextIndex];
  if (!episode) return null;
  return {
    server,
    serverIndex,
    episode,
    episodeIndex: nextIndex,
    key: getEpisodeKey(episode),
    embed: getEpisodeEmbed(episode),
  };
};

const buildAudioVariants = (movie, currentEpisode, currentEpisodeIndex) => {
  if (!movie || !currentEpisode) return [];
  const currentSlug = currentEpisode?.slug;
  const currentName = currentEpisode?.name;
  const currentKey = getEpisodeKey(currentEpisode);

  return (movie.episodes || []).map((server, serverIndex) => {
    const episodes = getEpisodeList(server);
    const matchedEpisode = episodes.find((episode, index) => (
      (currentSlug && episode?.slug === currentSlug) ||
      (currentName && episode?.name === currentName) ||
      (Number.isInteger(currentEpisodeIndex) && index === currentEpisodeIndex) ||
      getEpisodeKey(episode) === currentKey
    ));
    if (!matchedEpisode) return null;

    const episodeIndex = episodes.indexOf(matchedEpisode);
    const kind = inferAudioLabel(server?.server_name, movie?.lang || movie?.language);
    const serverName = String(server?.server_name || `Server ${serverIndex + 1}`).trim();
    const hasKindInServerName = normalizeText(serverName).includes(normalizeText(kind));
    const detail = `${serverName.startsWith('#') ? '' : '#'}${serverName}${hasKindInServerName ? '' : ` (${kind})`}`;

    return {
      id: `${serverIndex}:${getEpisodeKey(matchedEpisode)}`,
      label: `${kind} #${serverIndex + 1}`,
      detail,
      serverIndex,
      episodeIndex,
      episode: matchedEpisode,
    };
  }).filter(Boolean);
};

export default function MovieDetailContainer() {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentEmbed, setCurrentEmbed] = useState('');
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentEpName, setCurrentEpName] = useState('');
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  
  const [isFavorite, setIsFavorite] = useState(false);
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [relatedMovies, setRelatedMovies] = useState([]);

  const slug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('slug') : null;
  const episodeQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('episode') : null;

  const setActiveEpisode = (option, shouldScroll = false) => {
    if (!option?.episode) return;
    setCurrentEpisode(option.episode);
    setCurrentEmbed(option.embed || getEpisodeEmbed(option.episode));
    setCurrentEpName(option.episode.name);
    setCurrentServerIndex(option.serverIndex || 0);
    setCurrentEpisodeIndex(option.episodeIndex || 0);
    if (shouldScroll && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!slug) {
      setError('Không tìm thấy mã phim');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const data = await fetchOPhimJson(`/phim/${slug}`);
        if (data.status === 'success' || data.status === true) {
          const m = data.movie || data.item || data.data?.item;
          setMovie(m);
          loadRelatedMovies(m);
          
          if (m.episodes && m.episodes[0] && (m.episodes[0].server_data || m.episodes[0].items)) {
            const allEpisodes = getEpisodeOptions(m);
            const firstEpisode = allEpisodes.find(option => episodeQuery && option.key === episodeQuery) || allEpisodes[0];
            setActiveEpisode(firstEpisode);
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
  }, [slug, episodeQuery]);

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

  const loadRelatedMovies = async (movieData) => {
    try {
      const categorySlug = movieData?.category?.find(item => item.slug)?.slug;
      const countrySlug = movieData?.country?.find(item => item.slug)?.slug;
      const endpoint = categorySlug ? `/films/the-loai/${categorySlug}` : countrySlug ? `/films/quoc-gia/${countrySlug}` : '';
      if (!endpoint) return;
      const data = await fetchOPhimJson(`${endpoint}?page=1`);
      const items = getOPhimItems(data)
        .filter(item => item.slug && item.slug !== slug)
        .slice(0, 8);
      setRelatedMovies(items);
    } catch (err) {
      setRelatedMovies([]);
    }
  };

  const audioVariants = buildAudioVariants(movie, currentEpisode, currentEpisodeIndex);
  const currentAudioVariantId = `${currentServerIndex}:${getEpisodeKey(currentEpisode)}`;
  const nextEpisodeOption = getNextEpisodeOption(movie, currentServerIndex, currentEpisodeIndex);

  const renderPeopleLinks = (people, type) => (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {people.map(person => (
        <a
          key={`${type}-${person}`}
          href={`/person/?type=${type}&name=${encodeURIComponent(person)}`}
          className="rounded-md bg-white/8 px-2 py-1 text-xs font-semibold text-white hover:bg-[#ED2C25] hover:text-white"
        >
          {person}
        </a>
      ))}
    </span>
  );

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
            provider: movie.provider || 'kkphim',
            slug: movie.slug,
            name: movie.name,
            origin_name: movie.origin_name || movie.original_name || '',
            thumb_url: movie.thumb_url,
            poster_url: movie.poster_url,
            quality: movie.quality,
            year: movie.year,
            episode_current: movie.episode_current || movie.current_episode || '',
            episode_total: movie.episode_total || '',
            tmdbId: movie.tmdb?.id || null,
            tmdbType: movie.tmdb?.type || null,
            modified: movie.modified || null
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
        setComments([data.data, ...comments]);
        setNewComment('');
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
        <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="w-[150px] md:w-[200px] object-cover rounded-xl border border-white/10 shadow-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#ED2C25] text-white text-[10px] font-bold px-2 py-1 rounded">{movie.quality || 'HD'}</span>
            <span className="bg-white/10 text-white/70 text-[10px] font-bold px-2 py-1 rounded">{movie.year || '2026'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{movie.name}</h1>
          <h2 className="text-lg text-white/50 mb-4">{movie.original_name}</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm text-white/75 mb-6 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
            <div><strong className="text-white/40">Trạng thái:</strong> <span className="text-white font-medium">{movie.episode_current || movie.current_episode}</span></div>
            <div><strong className="text-white/40">Số tập:</strong> <span className="text-white font-medium">{movie.episode_total || 'N/A'}</span></div>
            <div><strong className="text-white/40">Ngôn ngữ:</strong> <span className="text-white font-medium">{movie.lang || movie.language}</span></div>
            <div><strong className="text-white/40">Thời lượng:</strong> <span className="text-white font-medium">{movie.time || 'N/A'}</span></div>
            <div><strong className="text-white/40">Năm phát hành:</strong> <span className="text-white font-medium">{movie.year || 'N/A'}</span></div>
            {(movie.tmdb?.vote_average || movie.imdb?.vote_average) ? (
              <div><strong className="text-white/40">Điểm số:</strong> <span className="text-white font-medium">{movie.tmdb?.vote_average ? `TMDB ${movie.tmdb.vote_average}` : `IMDB ${movie.imdb.vote_average}`}</span></div>
            ) : null}
            {movie.created?.time && (
              <div><strong className="text-white/40">Ngày đăng:</strong> <span className="text-white font-medium">{new Date(movie.created.time).toLocaleDateString('vi-VN')}</span></div>
            )}
            {movie.modified?.time && (
              <div><strong className="text-white/40">Cập nhật:</strong> <span className="text-white font-medium">{new Date(movie.modified.time).toLocaleDateString('vi-VN')}</span></div>
            )}
            {movie.category && Array.isArray(movie.category) && movie.category.length > 0 && (
              <div className="sm:col-span-2 md:col-span-3"><strong className="text-white/40">Thể loại:</strong> <span className="text-white font-medium">{movie.category.map(c => c.name).join(', ')}</span></div>
            )}
            {movie.country && Array.isArray(movie.country) && movie.country.length > 0 && (
              <div className="sm:col-span-2 md:col-span-3"><strong className="text-white/40">Quốc gia:</strong> <span className="text-white font-medium">{movie.country.map(c => c.name).join(', ')}</span></div>
            )}
            {movie.alternative_names && Array.isArray(movie.alternative_names) && movie.alternative_names.length > 0 && (
              <div className="sm:col-span-2 md:col-span-3"><strong className="text-white/40">Tên khác:</strong> <span className="text-white font-medium">{movie.alternative_names.join(', ')}</span></div>
            )}
            {movie.actor && Array.isArray(movie.actor) && movie.actor.length > 0 && (
              <div className="sm:col-span-2 md:col-span-3"><strong className="text-white/40">Diễn viên:</strong> <span className="text-white font-medium">{renderPeopleLinks(movie.actor, 'actor')}</span></div>
            )}
            {movie.director && Array.isArray(movie.director) && movie.director.length > 0 && (
              <div className="sm:col-span-2 md:col-span-3"><strong className="text-white/40">Đạo diễn:</strong> <span className="text-white font-medium">{renderPeopleLinks(movie.director, 'director')}</span></div>
            )}
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
      <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 relative mx-auto">
        {currentEpisode ? (
          <div className="aspect-video w-full bg-[#0A0A0A]">
            <MovieStreamPlayer
              episode={currentEpisode}
              movie={movie}
              movieSlug={slug}
              audioVariants={audioVariants}
              currentAudioVariantId={currentAudioVariantId}
              onSelectAudioVariant={(variant) => setActiveEpisode(variant)}
              onNextEpisode={nextEpisodeOption ? () => setActiveEpisode(nextEpisodeOption, true) : null}
            />
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
                  {getEpisodeList(server).map((ep, eIdx) => {
                    const epEmbed = getEpisodeEmbed(ep);
                    const isActiveEpisode = currentServerIndex === sIdx && currentEpisodeIndex === eIdx;
                    return (
                      <button 
                        key={eIdx}
                        onClick={() => setActiveEpisode({
                          server,
                          serverIndex: sIdx,
                          episode: ep,
                          episodeIndex: eIdx,
                          key: getEpisodeKey(ep),
                          embed: epEmbed,
                        }, true)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActiveEpisode || currentEmbed === epEmbed ? 'bg-[#ED2C25] text-white shadow-lg' : 'bg-[#1A1A1A] text-white/70 hover:bg-white/20'}`}
                      >
                        {ep.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#121212] rounded-xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-3">Nội Dung Phim</h3>
            <div className="text-sm text-white/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: movie.content || movie.description }} />
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
                <div key={c.id} className="flex gap-2.5 bg-[#1A1A1A] p-3 rounded-xl border border-white/5">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white flex items-center justify-center">
                    {c.avatar ? (
                      <img src={c.avatar} alt="" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#ED2C25]">{c.username}</span>
                      <span className="text-[10px] text-white/40">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-sm text-white/90 break-words">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmitComment} className="mt-auto relative">
            <input 
              type="text" 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Nhập bình luận của bạn..."
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-base md:text-sm text-white focus:outline-none focus:border-[#ED2C25] transition-colors"
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

      {relatedMovies.length > 0 && (
        <section className="rounded-xl border border-white/5 bg-[#121212] p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">Phim liên quan</h3>
            <a href="/movies/" className="text-sm font-semibold text-[#ED2C25] hover:text-red-300">Xem thêm</a>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {relatedMovies.map(item => (
              <a key={item.slug} href={`/movie-detail/?slug=${encodeURIComponent(item.slug)}`} className="group min-w-0">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/5 bg-[#1A1A1A]">
                  <img src={getOPhimImageUrl(item.thumb_url || item.poster_url)} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute right-1.5 top-1.5 rounded bg-[#ED2C25] px-1.5 py-0.5 text-[9px] font-bold text-white">{item.quality || item.episode_current || 'HD'}</span>
                </div>
                <div className="mt-2 line-clamp-2 text-xs font-semibold text-white/80 group-hover:text-[#ED2C25]">{item.name}</div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
