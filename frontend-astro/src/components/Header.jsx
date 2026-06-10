import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Search, User } from 'lucide-react';
import classNames from 'classnames';
import AuthModal from './AuthModal';
import { fetchNguoncJson, getNguoncItems } from '../lib/nguoncApi';

export default function Header({ toggleSidebar }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState('up');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const lastScrollY = useRef(0);
  const searchRef = useRef(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    const handleScroll = () => {
      if (!mainContainer) return;
      const current = mainContainer.scrollTop;
      setIsScrolled(current > 0);
      setScrollDirection(current > lastScrollY.current && current > 50 ? 'down' : 'up');
      lastScrollY.current = current;
    };
    const handleOutside = event => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    mainContainer?.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousedown', handleOutside);

    const token = localStorage.getItem('userToken');
    const name = localStorage.getItem('userName');
    if (token && name) setUser({ id: token, username: name });

    return () => {
      mainContainer?.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const requestId = ++searchRequestRef.current;
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchOpen(true);
      try {
        const [moviesResult, channelsResult] = await Promise.allSettled([
          fetchNguoncJson(`/films/search?keyword=${encodeURIComponent(query)}`),
          fetch('/api/iptv/channels').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
        ]);
        if (requestId !== searchRequestRef.current) return;

        const movies = moviesResult.status === 'fulfilled'
          ? getNguoncItems(moviesResult.value).slice(0, 5).map(movie => ({
            name: movie.name,
            subtitle: movie.original_name || movie.year || 'Phim',
            image: movie.thumb_url || movie.poster_url || '/poster.jpg',
            key: `movie-${movie.slug}`,
            type: 'movie',
            link: `/movie-detail/?slug=${encodeURIComponent(movie.slug)}`,
          }))
          : [];
        const channels = channelsResult.status === 'fulfilled' && channelsResult.value.success
          ? channelsResult.value.data
            .filter(channel => `${channel.name} ${channel.group || ''}`.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map(channel => ({
              name: channel.name,
              subtitle: channel.group || 'Kênh truyền hình',
              image: channel.logo || '/poster.jpg',
              key: `tv-${channel.id}`,
              type: 'tv',
              link: `/tv/?channel=${encodeURIComponent(channel.id)}`,
            }))
          : [];
        setSearchResults([...movies, ...channels]);
      } catch (err) {
        if (requestId === searchRequestRef.current) setSearchResults([]);
      } finally {
        if (requestId === searchRequestRef.current) setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const submitSearch = () => {
    const query = searchQuery.trim();
    if (query) window.location.href = `/movies/?search=${encodeURIComponent(query)}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    setUser(null);
  };

  return (
    <header className={classNames('fixed left-0 right-0 top-0 z-50 flex h-[64px] items-center justify-between px-4 transition-all duration-300 md:px-8', {
      'border-b border-white/10 bg-black/85 backdrop-blur-md': isScrolled,
      'bg-black/60': !isScrolled,
      '-translate-y-full': scrollDirection === 'down',
    })}>
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="rounded-full p-2 hover:bg-white/10 md:hidden" title="Mở menu"><Menu size={24} /></button>
        <a href="/" className="mr-4 flex items-center"><img src="/logo/logo.png?v=1.65" alt="NhanChillTV" className="h-9 object-contain" /></a>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Trang chủ</a>
          <a href="/tv/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Truyền hình</a>
          <a href="/events/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Sự kiện</a>
          <a href="/movies/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Phim</a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div ref={searchRef} className={classNames('relative', isMobileSearchOpen ? 'fixed left-0 right-0 top-[64px] block border-b border-white/10 bg-[#121212] p-4 shadow-xl md:relative md:top-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none' : 'hidden md:block')}>
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setSearchOpen(true)}
            onKeyDown={event => event.key === 'Enter' && submitSearch()}
            placeholder="Tìm phim, kênh TV..."
            className="w-full rounded-full border border-white/20 bg-[#1A1A1A] py-2 pl-4 pr-10 text-sm text-white outline-none focus:border-[#ED2C25] md:w-[280px]"
          />
          <Search size={18} className="absolute right-7 top-1/2 -translate-y-1/2 text-white/45 md:right-3" />

          {searchOpen && searchQuery.trim().length > 1 && (
            <div className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#171717] shadow-2xl md:left-0 md:right-auto md:w-[360px]">
              {isSearching && <div className="p-4 text-sm text-white/50">Đang tìm kiếm...</div>}
              {!isSearching && !searchResults.length && <div className="p-4 text-sm text-white/50">Không có kết quả phù hợp.</div>}
              {!isSearching && searchResults.map(result => (
                <a key={result.key} href={result.link} className="flex items-center gap-3 border-b border-white/5 p-2.5 last:border-0 hover:bg-white/5">
                  <img src={result.image} alt={result.name} className="h-14 w-10 rounded object-cover" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-sm font-semibold text-white">{result.type === 'tv' && <span className="rounded bg-[#ED2C25] px-1 py-0.5 text-[8px] font-bold">LIVE</span>}{result.name}</div>
                    <div className="truncate text-xs text-white/45">{result.subtitle}</div>
                  </div>
                </a>
              ))}
              <button onClick={submitSearch} className="w-full px-3 py-2.5 text-xs font-semibold text-[#ED2C25] hover:bg-[#ED2C25]/10">Xem kết quả phim đầy đủ</button>
            </div>
          )}
        </div>

        <button onClick={() => setIsMobileSearchOpen(open => !open)} className="rounded-full p-2 hover:bg-white/10 md:hidden" title="Tìm kiếm"><Search size={22} /></button>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium md:block">{user.username}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ED2C25]"><User size={17} /></span>
            <button onClick={handleLogout} className="rounded-full p-2 text-white/65 hover:bg-white/10 hover:text-white" title="Đăng xuất"><LogOut size={18} /></button>
          </div>
        ) : (
          <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"><User size={16} /> <span className="hidden sm:inline">Đăng nhập</span></button>
        )}
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={setUser} />
    </header>
  );
}
