import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { fetchNguoncJson, getNguoncItems } from '../lib/nguoncApi';

export default function MoviesContainer() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('/films/phim-moi-cap-nhat');
  const [title, setTitle] = useState('Phim Mới Cập Nhật');
  const [pagination, setPagination] = useState(null);
  
  const initialSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('search') : '';
  const [search, setSearch] = useState(initialSearch || '');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const fetchMovies = async (endpoint, page = 1, customTitle) => {
    setLoading(true);
    try {
      let url = endpoint;
      url = url.includes('?') ? `${url}&page=${page}` : `${url}?page=${page}`;
      
      const data = await fetchNguoncJson(url);
      
      if (data.status === 'success') {
        setMovies(getNguoncItems(data));
        setPagination(data.paginate);
        if (customTitle) setTitle(customTitle);
      } else {
        setMovies([]);
        setPagination(null);
      }
    } catch (e) {
      console.error(e);
      setMovies([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialSearch) {
      const endpoint = `/films/search?keyword=${encodeURIComponent(initialSearch)}`;
      setActiveTab(endpoint);
      setTitle(`Kết quả tìm kiếm: ${initialSearch}`);
      fetchMovies(endpoint, 1, `Kết quả tìm kiếm: ${initialSearch}`);
    } else {
      fetchMovies(activeTab);
    }
  }, []);

  useEffect(() => {
    if (!initialSearch || activeTab !== `/films/search?keyword=${encodeURIComponent(initialSearch)}`) {
      fetchMovies(activeTab);
    }
  }, [activeTab]);

  const handleSearch = () => {
    if (!search) return;
    setFilterGenre('');
    setFilterCountry('');
    setFilterYear('');
    const endpoint = `/films/search?keyword=${encodeURIComponent(search)}`;
    setActiveTab(endpoint);
    setTitle(`Kết quả tìm kiếm: ${search}`);
  };

  const loadFavorites = async () => {
    setLoading(true);
    setActiveTab('favorites');
    setTitle('Phim Yêu Thích');
    const token = localStorage.getItem('userToken');
    if (!token) {
      setMovies([]);
      setPagination(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user/favorites', {
        headers: { 'x-user-id': token }
      });
      const data = await res.json();
      if (data.success) {
        setMovies(data.data.movies || []);
        setPagination(null);
      }
    } catch (e) {
      setMovies([]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121212] p-4 rounded-xl border border-white/5">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Tìm tên phim..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="bg-[#1A1A1A] border border-white/10 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-[#ED2C25] text-white w-[200px]"
            />
            <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => { setActiveTab('/films/phim-moi-cap-nhat'); setTitle('Phim Mới Cập Nhật'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === '/films/phim-moi-cap-nhat' ? 'bg-[#ED2C25] text-white' : 'bg-[#1A1A1A] hover:bg-white/10 text-white/70'}`}>Mới Cập Nhật</button>
        <button onClick={() => { setActiveTab('/films/danh-sach/phim-bo'); setTitle('Phim Bộ'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === '/films/danh-sach/phim-bo' ? 'bg-[#ED2C25] text-white' : 'bg-[#1A1A1A] hover:bg-white/10 text-white/70'}`}>Phim Bộ</button>
        <button onClick={() => { setActiveTab('/films/danh-sach/phim-le'); setTitle('Phim Lẻ'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === '/films/danh-sach/phim-le' ? 'bg-[#ED2C25] text-white' : 'bg-[#1A1A1A] hover:bg-white/10 text-white/70'}`}>Phim Lẻ</button>
        <button onClick={loadFavorites} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'favorites' ? 'bg-[#ED2C25] text-white' : 'bg-[#1A1A1A] hover:bg-white/10 text-white/70'}`}>Yêu Thích</button>
        
        <select 
          value={filterGenre} 
          onChange={e => {
            setFilterGenre(e.target.value);
            if(e.target.value) {
              setFilterCountry('');
              setFilterYear('');
              setActiveTab(`/films/danh-sach/${e.target.value}`);
              setTitle('Lọc danh mục');
            } else {
              setActiveTab('/films/phim-moi-cap-nhat');
            }
          }}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ED2C25] ml-auto"
        >
          <option value="">-- Thể Loại --</option>
          <option value="hanh-dong">Hành Động</option>
          <option value="tinh-cam">Tình Cảm</option>
          <option value="hai-huoc">Hài Hước</option>
          <option value="co-trang">Cổ Trang</option>
          <option value="kinh-di">Kinh Dị</option>
          <option value="hoat-hinh">Hoạt Hình</option>
        </select>

        <select
          value={filterCountry}
          onChange={e => {
            setFilterCountry(e.target.value);
            if (e.target.value) {
              setFilterGenre('');
              setFilterYear('');
              setActiveTab(`/films/quoc-gia/${e.target.value}`);
              setTitle('Lọc quốc gia');
            } else {
              setActiveTab('/films/phim-moi-cap-nhat');
            }
          }}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ED2C25]"
        >
          <option value="">-- Quốc Gia --</option>
          <option value="viet-nam">Việt Nam</option>
          <option value="han-quoc">Hàn Quốc</option>
          <option value="trung-quoc">Trung Quốc</option>
          <option value="thai-lan">Thái Lan</option>
          <option value="au-my">Âu Mỹ</option>
          <option value="nhat-ban">Nhật Bản</option>
        </select>

        <select
          value={filterYear}
          onChange={e => {
            setFilterYear(e.target.value);
            if (e.target.value) {
              setFilterGenre('');
              setFilterCountry('');
              setActiveTab(`/films/nam-phat-hanh/${e.target.value}`);
              setTitle(`Năm phát hành ${e.target.value}`);
            } else {
              setActiveTab('/films/phim-moi-cap-nhat');
            }
          }}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ED2C25]"
        >
          <option value="">-- Năm --</option>
          {Array.from({ length: 12 }, (_, idx) => new Date().getFullYear() - idx).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
            <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-20 text-white/50">Không tìm thấy dữ liệu.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.map(m => (
              <a key={m.slug} href={`/movie-detail/?slug=${m.slug}`} className="group relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1A1A1A] border border-white/5 hover:border-[#ED2C25]/50 transition-all cursor-pointer">
                <img src={m.thumb_url} alt={m.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                <div className="absolute top-2 right-2 bg-[#ED2C25] text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                  {m.quality || m.time || 'HD'}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-[#ED2C25] transition-colors">{m.name}</h3>
                  <p className="text-xs text-white/60">{m.original_name || m.year}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-[#ED2C25] flex items-center justify-center shadow-xl shadow-red-500/50">
                    <Play size={20} className="text-white ml-1" fill="currentColor" />
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalItems > 0 && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button 
                onClick={() => fetchMovies(activeTab, pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                className="p-2 rounded-lg bg-white/10 hover:bg-[#ED2C25] disabled:opacity-50 disabled:hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-medium">
                Trang {pagination.currentPage} / {pagination.totalPages}
              </span>
              <button 
                onClick={() => fetchMovies(activeTab, pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="p-2 rounded-lg bg-white/10 hover:bg-[#ED2C25] disabled:opacity-50 disabled:hover:bg-white/10 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
