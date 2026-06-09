import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, User, Bell, LogOut } from 'lucide-react';
import classNames from 'classnames';
import AuthModal from './AuthModal';

export default function Header({ toggleSidebar }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState('up');
  const lastScrollY = useRef(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    const handleScroll = () => {
      if (!mainContainer) return;
      const currentScrollY = mainContainer.scrollTop;
      setIsScrolled(currentScrollY > 0);
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY.current) {
        setScrollDirection('up');
      }
      lastScrollY.current = currentScrollY;
    };
    
    if (mainContainer) {
      mainContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    // Check login
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('userToken');
      const name = localStorage.getItem('userName');
      if (token && name) {
        setUser({ id: token, username: name });
      }
    }

    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      if (mainContainer) {
        mainContainer.removeEventListener('scroll', handleScroll);
      }
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    setUser(null);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (val.trim().length > 1) {
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          // Fetch Movies
          const moviesRes = await fetch(`https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(val)}`);
          const moviesData = await moviesRes.json();
          let items = [];
          if (moviesData.status === 'success') {
            items = (moviesData.items || moviesData.data.items || []).map(m => ({
              ...m,
              type: 'movie',
              link: `/movie-detail/?slug=${m.slug}`
            }));
          }

          // Fetch TV Channels
          const tvRes = await fetch('/api/iptv/channels');
          const tvData = await tvRes.json();
          if (tvData.success) {
            const tvItems = tvData.data
              .filter(c => c.name.toLowerCase().includes(val.toLowerCase()) || (c.group && c.group.toLowerCase().includes(val.toLowerCase())))
              .map(c => ({
                name: c.name,
                original_name: c.group || 'Kênh Truyền Hình',
                thumb_url: c.logo || '/poster.jpg',
                slug: c.id,
                type: 'tv',
                link: `/tv/?channel=${c.id}`
              }));
            items = [...tvItems, ...items];
          }

          setSearchResults(items.slice(0, 8)); // Show top 8 mixed results
        } catch (e) {
          console.error(e);
        }
        setIsSearching(false);
      }, 500); // 500ms debounce to prevent IME interruption
    } else {
      setSearchResults([]);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      window.location.href = `/movies/?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header
      className={classNames(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-4 md:px-8 h-[64px] flex items-center justify-between',
        {
          'bg-black/30 backdrop-blur-md border-b border-white/10': isScrolled,
          'bg-gradient-to-b from-black/80 to-transparent': !isScrolled,
          '-translate-y-full': scrollDirection === 'down'
        }
      )}
    >
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-full md:hidden">
          <Menu size={24} />
        </button>
        <a href="/" className="flex items-center gap-2 mr-4">
          <img src="/logo/logo.png?v=1.65" alt="NhanChillTV" className="h-[36px] object-contain" onError={(e) => {
            e.target.src = 'https://via.placeholder.com/150x50?text=NhanChillTV';
          }} />
        </a>

        {/* Top Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="/" className="text-white/80 hover:text-[#ED2C25] font-semibold transition-colors">Trang chủ</a>
          <a href="/tv/" className="text-white/80 hover:text-[#ED2C25] font-semibold transition-colors">Truyền hình</a>
          <a href="/events/" className="text-white/80 hover:text-[#ED2C25] font-semibold transition-colors">Sự kiện</a>
          <a href="/movies/" className="text-white/80 hover:text-[#ED2C25] font-semibold transition-colors">Phim</a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className={classNames(
          isMobileSearchOpen ? "fixed top-[64px] left-0 right-0 p-4 bg-[#121212] border-b border-white/10 md:relative md:top-0 md:p-0 md:bg-transparent md:border-none block shadow-xl md:shadow-none z-40" : "hidden relative md:block"
        )} ref={searchRef}>
          <input 
            type="text" 
            placeholder="Tìm kiếm phim, tivi..." 
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearch}
            className="bg-[#1A1A1A] md:bg-white/10 border border-white/20 rounded-full py-2 pl-4 pr-10 text-sm text-white placeholder-white/50 focus:outline-none focus:border-[#ED2C25] w-full md:w-[250px] transition-all"
          />
          <Search size={18} className="absolute right-7 md:right-3 top-1/2 -translate-y-1/2 text-white/50" />
          
          {/* Search Preview Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-4 right-4 md:left-0 md:right-auto md:w-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
              {searchResults.map(m => (
                <a key={`${m.type}-${m.slug}`} href={m.link} className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                  <img src={m.thumb_url} alt={m.name} className="w-10 h-14 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                      {m.type === 'tv' && <span className="bg-[#ED2C25] text-white text-[8px] px-1 rounded uppercase tracking-wider">LIVE</span>}
                      {m.name}
                    </div>
                    <div className="text-xs text-white/50 truncate">{m.original_name}</div>
                  </div>
                </a>
              ))}
              <button 
                onClick={() => window.location.href = `/movies/?search=${encodeURIComponent(searchQuery)}`}
                className="w-full p-2 text-xs text-center text-[#ED2C25] hover:bg-[#ED2C25]/10 transition-colors font-semibold"
              >
                Xem tất cả kết quả
              </button>
            </div>
          )}
        </div>
        
        <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="p-2 hover:bg-white/10 rounded-full md:hidden transition-colors">
          <Search size={24} className={isMobileSearchOpen ? "text-[#ED2C25]" : "text-white"} />
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium hidden md:block">Hi, {user.username}</span>
            <div className="w-[32px] h-[32px] rounded-full bg-gradient-to-br from-[#ED2C25] to-orange-500 flex items-center justify-center cursor-pointer shadow-lg shadow-[#ED2C25]/20">
              <User size={18} className="text-white" />
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-[#ED2C25] transition-colors" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 transition-colors text-white font-medium text-sm px-4 py-2 rounded-full flex items-center gap-2"
          >
            <User size={16} /> Đăng nhập
          </button>
        )}
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={setUser} 
      />
    </header>
  );
}
