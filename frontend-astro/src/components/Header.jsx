import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Search, Trophy, User, X } from 'lucide-react';
import classNames from 'classnames';
import AuthModal from './AuthModal';
import { fetchOPhimJson, getOPhimItems } from '../lib/OPhimApi';
import AvatarPicker from './AvatarPicker';

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
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const lastScrollY = useRef(0);
  const searchRef = useRef(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    let frame = 0;
    const handleScroll = () => {
      if (!mainContainer || frame) return;
      frame = requestAnimationFrame(() => {
        const current = mainContainer.scrollTop;
        const delta = current - lastScrollY.current;
        const scrolled = current > 0;
        // Dead-zone: only change direction when scroll delta > 5px to prevent micro-flicker
        if (Math.abs(delta) > 5) {
          const direction = delta > 0 && current > 50 ? 'down' : 'up';
          setScrollDirection(value => value === direction ? value : direction);
        }
        setIsScrolled(value => value === scrolled ? value : scrolled);
        lastScrollY.current = current;
        frame = 0;
      });
    };
    const handleOutside = event => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    mainContainer?.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousedown', handleOutside);

    const token = localStorage.getItem('userToken');
    const name = localStorage.getItem('userName');
    if (token && name) {
      const cachedAvatar = localStorage.getItem('userAvatar');
      setUser({ id: token, username: name, avatar: cachedAvatar });
      fetch('/api/user/profile', { headers: { 'x-user-id': token } })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!data?.success) return;
          setUser(data.data);
          if (data.data.avatar) localStorage.setItem('userAvatar', data.data.avatar);
        })
        .catch(() => {});
    }

    return () => {
      mainContainer?.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleOutside);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isMobileSearchOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMobileSearchOpen]);

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
          fetchOPhimJson(`/films/search?keyword=${encodeURIComponent(query)}`),
          fetch('/api/iptv/channels').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
        ]);
        if (requestId !== searchRequestRef.current) return;

        const movies = moviesResult.status === 'fulfilled'
          ? getOPhimItems(moviesResult.value).slice(0, 5).map(movie => ({
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
    localStorage.removeItem('userAvatar');
    setUser(null);
  };

  return (
    <header className={classNames('fixed left-0 right-0 top-0 z-50 flex h-[64px] items-center justify-between px-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:px-8', {
      'border-b border-white/10 bg-black/95 md:bg-black/85 md:backdrop-blur-md': isScrolled,
      'bg-black/60': !isScrolled,
      '-translate-y-full': scrollDirection === 'down' && !isMobileSearchOpen,
    })} style={{ willChange: 'transform' }}>
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="rounded-full p-2 hover:bg-white/10 md:hidden" title="Mở menu"><Menu size={24} /></button>
        <a href="/" className="mr-4 flex items-center"><img src="/logo/logo.png?v=1.65" alt="NhanChillTV" className="h-9 object-contain" /></a>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Trang chủ</a>
          <a href="/tv/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Truyền hình</a>
          <a href="/events/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Sự kiện</a>
          <a href="/worldcup/" className="inline-flex items-center gap-1.5 font-semibold text-white/80 hover:text-[#ED2C25]"><Trophy size={16} /> World Cup</a>
          <a href="/movies/" className="font-semibold text-white/80 hover:text-[#ED2C25]">Phim</a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div ref={searchRef} className={classNames(isMobileSearchOpen ? 'mobile-search-panel fixed inset-0 z-[70] block bg-black md:relative md:inset-auto md:min-h-0 md:bg-transparent md:p-0' : 'relative hidden md:block')}>
          {isMobileSearchOpen && <div className="mb-4 flex items-center justify-between md:hidden"><span className="font-bold">Tìm kiếm</span><button onClick={() => { setIsMobileSearchOpen(false); setSearchOpen(false); }} className="rounded-full p-2 hover:bg-white/10" title="Đóng"><X size={22} /></button></div>}
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onFocus={() => searchQuery.trim().length > 1 && setSearchOpen(true)}
            onKeyDown={event => event.key === 'Enter' && submitSearch()}
            placeholder="Tìm phim, kênh TV..."
            autoFocus={isMobileSearchOpen}
            className="w-full rounded-md border border-white/20 bg-[#1A1A1A] py-3 pl-4 pr-11 text-base text-white outline-none focus:border-[#ED2C25] md:w-[280px] md:rounded-full md:py-2 md:text-sm"
          />
          <Search size={18} className={`absolute right-7 text-white/45 md:right-3 ${isMobileSearchOpen ? 'mobile-search-icon' : 'top-1/2 -translate-y-1/2'}`} />

          {searchOpen && searchQuery.trim().length > 1 && (
            <div className="mobile-search-results mt-3 overflow-y-auto rounded-lg border border-white/10 bg-[#171717] shadow-2xl md:absolute md:left-0 md:top-full md:mt-2 md:max-h-none md:w-[360px]">
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
            <button onClick={() => setIsAvatarPickerOpen(true)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white" title="Đổi avatar">
              {user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-contain p-1" /> : <User size={17} className="text-[#ED2C25]" />}
            </button>
            <button onClick={handleLogout} className="rounded-full p-2 text-white/65 hover:bg-white/10 hover:text-white" title="Đăng xuất"><LogOut size={18} /></button>
          </div>
        ) : (
          <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"><User size={16} /> <span className="hidden sm:inline">Đăng nhập</span></button>
        )}
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={setUser} />
      {isAvatarPickerOpen && user && <AvatarPicker user={user} onClose={() => setIsAvatarPickerOpen(false)} onSaved={setUser} />}
    </header>
  );
}
