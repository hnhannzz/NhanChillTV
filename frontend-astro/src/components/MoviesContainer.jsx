import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Search } from 'lucide-react';
import { fetchNguoncJson, getNguoncItems, getNguoncPagination, isNguoncSuccess, getOPhimImageUrl } from '../lib/nguoncApi';

const GENRES = [
  ['Hành Động', 'hanh-dong'], ['Phiêu Lưu', 'phieu-luu'], ['Hoạt Hình', 'hoat-hinh'], ['Hài', 'hai'],
  ['Hình Sự', 'hinh-su'], ['Tài Liệu', 'tai-lieu'], ['Chính Kịch', 'chinh-kich'], ['Gia Đình', 'gia-dinh'],
  ['Giả Tưởng', 'gia-tuong'], ['Lịch Sử', 'lich-su'], ['Kinh Dị', 'kinh-di'], ['Nhạc', 'nhac'], ['Bí Ẩn', 'bi-an'],
  ['Lãng Mạn', 'lang-man'], ['Khoa Học Viễn Tưởng', 'khoa-hoc-vien-tuong'], ['Gây Cấn', 'gay-can'],
  ['Chiến Tranh', 'chien-tranh'], ['Tâm Lý', 'tam-ly'], ['Tình Cảm', 'tinh-cam'], ['Cổ Trang', 'co-trang'], ['Miền Tây', 'mien-tay'],
];

const COUNTRIES = [
  ['Âu Mỹ', 'au-my'], ['Anh', 'anh'], ['Trung Quốc', 'trung-quoc'], ['Indonesia', 'indonesia'], ['Việt Nam', 'viet-nam'],
  ['Pháp', 'phap'], ['Hồng Kông', 'hong-kong'], ['Hàn Quốc', 'han-quoc'], ['Nhật Bản', 'nhat-ban'],
  ['Thái Lan', 'thai-lan'], ['Đài Loan', 'dai-loan'], ['Nga', 'nga'], ['Hà Lan', 'ha-lan'],
  ['Philippines', 'philippines'], ['Ấn Độ', 'an-do'], ['Quốc gia khác', 'quoc-gia-khac'],
];

const YEARS = Array.from({ length: 23 }, (_, index) => String(2026 - index));

export default function MoviesContainer() {
  const initialSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('search') || '' : '';
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endpoint, setEndpoint] = useState(initialSearch ? `/films/search?keyword=${encodeURIComponent(initialSearch)}` : '/films/phim-moi-cap-nhat');
  const [title, setTitle] = useState(initialSearch ? `Kết quả tìm kiếm: ${initialSearch}` : 'Phim mới cập nhật');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState(initialSearch);
  const [genre, setGenre] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [favoritesMode, setFavoritesMode] = useState(false);

  useEffect(() => {
    if (favoritesMode) return undefined;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const separator = endpoint.includes('?') ? '&' : '?';
        const data = await fetchNguoncJson(`${endpoint}${separator}page=${page}`, { signal: controller.signal });
        if (!isNguoncSuccess(data)) throw new Error('Nguonc returned no data');
        setMovies(getNguoncItems(data));
        setPagination(getNguoncPagination(data));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setMovies([]);
          setPagination(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [endpoint, favoritesMode, page]);

  const selectEndpoint = (nextEndpoint, nextTitle) => {
    setFavoritesMode(false);
    setEndpoint(nextEndpoint);
    setTitle(nextTitle);
    setPage(1);
  };

  const submitSearch = () => {
    const query = search.trim();
    if (!query) return;
    setGenre(''); setCountry(''); setYear('');
    selectEndpoint(`/films/search?keyword=${encodeURIComponent(query)}`, `Kết quả tìm kiếm: ${query}`);
  };

  const loadFavorites = async () => {
    setFavoritesMode(true);
    setTitle('Phim yêu thích');
    setLoading(true);
    setPagination(null);
    const token = localStorage.getItem('userToken');
    if (!token) {
      setMovies([]);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/user/favorites', { headers: { 'x-user-id': token } });
      const data = await response.json();
      setMovies(data.success ? data.data.movies || [] : []);
    } catch {
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const changeGenre = value => {
    setGenre(value); setCountry(''); setYear('');
    if (!value) return selectEndpoint('/films/phim-moi-cap-nhat', 'Phim mới cập nhật');
    const label = GENRES.find(item => item[1] === value)?.[0] || value;
    selectEndpoint(`/films/the-loai/${value}`, `Thể loại: ${label}`);
  };

  const changeCountry = value => {
    setCountry(value); setGenre(''); setYear('');
    if (!value) return selectEndpoint('/films/phim-moi-cap-nhat', 'Phim mới cập nhật');
    const label = COUNTRIES.find(item => item[1] === value)?.[0] || value;
    selectEndpoint(`/films/quoc-gia/${value}`, `Quốc gia: ${label}`);
  };

  const changeYear = value => {
    setYear(value); setGenre(''); setCountry('');
    if (!value) return selectEndpoint('/films/phim-moi-cap-nhat', 'Phim mới cập nhật');
    selectEndpoint(`/films/nam-phat-hanh/${value}`, `Năm phát hành ${value}`);
  };

  const pageLabel = useMemo(() => pagination ? `Trang ${pagination.currentPage} / ${pagination.totalPages}` : '', [pagination]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <div className="relative w-full md:w-72">
          <input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && submitSearch()} placeholder="Tìm tên phim..." className="w-full rounded-md border border-white/10 bg-[#171717] py-2 pl-3 pr-10 text-sm text-white outline-none focus:border-[#ED2C25]" />
          <button onClick={submitSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white" title="Tìm kiếm"><Search size={17} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setGenre(''); setCountry(''); setYear(''); selectEndpoint('/films/phim-moi-cap-nhat', 'Phim mới cập nhật'); }} className="rounded-md bg-[#ED2C25] px-3 py-2 text-sm font-medium text-white">Mới cập nhật</button>
        <button onClick={() => selectEndpoint('/films/danh-sach/phim-bo', 'Phim bộ')} className="rounded-md bg-[#1A1A1A] px-3 py-2 text-sm text-white/75 hover:bg-white/10">Phim bộ</button>
        <button onClick={() => selectEndpoint('/films/danh-sach/phim-le', 'Phim lẻ')} className="rounded-md bg-[#1A1A1A] px-3 py-2 text-sm text-white/75 hover:bg-white/10">Phim lẻ</button>
        <button onClick={loadFavorites} className="rounded-md bg-[#1A1A1A] px-3 py-2 text-sm text-white/75 hover:bg-white/10">Yêu thích</button>
        <select value={genre} onChange={event => changeGenre(event.target.value)} className="min-w-[150px] rounded-md border border-white/10 bg-[#171717] px-3 py-2 text-sm text-white outline-none focus:border-[#ED2C25]"><option value="">Thể loại</option>{GENRES.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={country} onChange={event => changeCountry(event.target.value)} className="min-w-[150px] rounded-md border border-white/10 bg-[#171717] px-3 py-2 text-sm text-white outline-none focus:border-[#ED2C25]"><option value="">Quốc gia</option>{COUNTRIES.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={year} onChange={event => changeYear(event.target.value)} className="min-w-[105px] rounded-md border border-white/10 bg-[#171717] px-3 py-2 text-sm text-white outline-none focus:border-[#ED2C25]"><option value="">Năm</option>{YEARS.map(value => <option key={value} value={value}>{value}</option>)}</select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />)}</div>
      ) : !movies.length ? (
        <div className="rounded-lg border border-white/5 bg-[#151515] py-16 text-center text-white/50">Không tìm thấy dữ liệu.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map(movie => (
              <a key={movie.slug || movie.id} href={`/movie-detail/?slug=${encodeURIComponent(movie.slug)}`} className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-white/5 bg-[#1A1A1A] hover:border-[#ED2C25]/50">
                <img src={getOPhimImageUrl(movie.thumb_url || movie.poster_url)} alt={movie.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                <span className="absolute right-2 top-2 rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-bold text-white">{movie.quality || movie.episode_current || 'HD'}</span>
                <div className="absolute bottom-0 left-0 right-0 p-3"><h3 className="line-clamp-1 text-sm font-bold text-white group-hover:text-[#ED2C25]">{movie.name}</h3><p className="truncate text-xs text-white/55">{movie.original_name || movie.year}</p></div>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ED2C25]"><Play size={19} fill="currentColor" className="ml-0.5" /></span></span>
              </a>
            ))}
          </div>
          {pagination?.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4">
              <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={pagination.currentPage <= 1} className="rounded-md bg-white/10 p-2 disabled:opacity-35" title="Trang trước"><ChevronLeft size={20} /></button>
              <span className="text-sm font-medium text-white/70">{pageLabel}</span>
              <button onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))} disabled={pagination.currentPage >= pagination.totalPages} className="rounded-md bg-white/10 p-2 disabled:opacity-35" title="Trang sau"><ChevronRight size={20} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
