import React, { useEffect, useState, useRef } from 'react';

export default function WorldCupTicker() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [scrollDirection, setScrollDirection] = useState('up');
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const scrollRef = useRef(null);

  // Check path visibility
  useEffect(() => {
    const checkVisibility = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      setIsVisible(path.includes('/worldcup') || (path.includes('/tv') && search.includes('matchId')));
    };
    checkVisibility();
  }, []);

  // Sync scroll hiding with Header
  useEffect(() => {
    if (!isVisible) return undefined;
    const mainContainer = document.getElementById('main-scroll-container');
    if (!mainContainer) return undefined;

    let lastScrollY = mainContainer.scrollTop;
    const handleScroll = () => {
      const currentScrollY = mainContainer.scrollTop;
      const delta = currentScrollY - lastScrollY;
      if (Math.abs(delta) > 5) {
        const direction = delta > 0 && currentScrollY > 50 ? 'down' : 'up';
        setScrollDirection(direction);
      }
      lastScrollY = currentScrollY;
    };

    mainContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContainer.removeEventListener('scroll', handleScroll);
  }, [isVisible]);

  // Fetch data
  useEffect(() => {
    if (!isVisible) return;
    
    // Fetch teams
    fetch('/api/worldcup/teams')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.teams) {
          const map = {};
          data.teams.forEach(t => { map[t.id] = t; });
          setTeams(map);
        }
      })
      .catch(err => console.error('Error fetching teams for ticker:', err));

    // Fetch games and poll
    const fetchGames = () => {
      fetch('/api/worldcup/games')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.games) {
            const sorted = data.games.sort((a, b) => {
              const aLive = a.finished !== 'TRUE' && a.time_elapsed !== 'not_started' && a.time_elapsed !== 'notstarted';
              const bLive = b.finished !== 'TRUE' && b.time_elapsed !== 'not_started' && b.time_elapsed !== 'notstarted';
              if (aLive && !bLive) return -1;
              if (!aLive && bLive) return 1;

              const aFinished = a.finished === 'TRUE';
              const bFinished = b.finished === 'TRUE';
              if (!aFinished && bFinished) return -1;
              if (aFinished && !bFinished) return 1;

              return new Date(a.local_date) - new Date(b.local_date);
            });
            setGames(sorted.slice(0, 15));
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching games for ticker:', err);
          setLoading(false);
        });
    };

    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [isVisible]);

  // Programmatic looping marquee scroll effect (pauses on user drag/swipe)
  useEffect(() => {
    if (isUserInteracting || games.length === 0 || !scrollRef.current) return undefined;

    const container = scrollRef.current;
    let animationFrameId;
    const speed = 0.35; // Increased scroll speed for improved responsiveness (Wave 3)
    let accumulatedX = container.scrollLeft;

    const scrollLoop = () => {
      accumulatedX += speed;
      const halfWidth = container.scrollWidth / 2;
      if (accumulatedX >= halfWidth) {
        accumulatedX = 0;
      }
      container.scrollLeft = Math.round(accumulatedX);
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    const startDelay = setTimeout(() => {
      accumulatedX = container.scrollLeft;
      animationFrameId = requestAnimationFrame(scrollLoop);
    }, 1500);

    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(animationFrameId);
    };
  }, [games, isUserInteracting]);

  if (!isVisible || (loading && games.length === 0) || games.length === 0) return null;

  // Duplicate items array to make the infinite loop transition seamless
  const displayGames = [...games, ...games];

  const tickerClass = `fixed left-0 right-0 z-40 h-[38px] border-b border-white/5 bg-black/95 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] top-[64px] ${
    scrollDirection === 'down' ? '-translate-y-[102px]' : 'translate-y-0'
  }`;

  return (
    <div className={tickerClass} style={{ willChange: 'transform' }}>
      <div className="flex h-full items-center">
        {/* Ticker Title */}
        <div className="relative z-10 flex h-full items-center bg-[#ED2C25] px-3 text-[10px] md:text-xs font-black uppercase tracking-wider text-white select-none">
          <span className="animate-pulse mr-1">⚽</span> Live Score
        </div>
        
        {/* Infinite Scroll Container */}
        <div 
          ref={scrollRef}
          onMouseDown={() => setIsUserInteracting(true)}
          onMouseUp={() => setIsUserInteracting(false)}
          onMouseLeave={() => setIsUserInteracting(false)}
          onTouchStart={() => setIsUserInteracting(true)}
          onTouchEnd={() => setIsUserInteracting(false)}
          className="no-scrollbar flex flex-1 h-full items-center gap-4 overflow-x-auto px-4 py-1 select-none cursor-grab active:cursor-grabbing"
        >
          {displayGames.map((game, idx) => {
            const isLive = game.finished !== 'TRUE' && game.time_elapsed !== 'not_started' && game.time_elapsed !== 'notstarted';
            const isFinished = game.finished === 'TRUE';
            const homeFlag = teams[game.home_team_id]?.flag;
            const awayFlag = teams[game.away_team_id]?.flag;
            
            return (
              <a
                key={`${game.id}-${idx}`}
                href={`/tv/?matchId=${game.id}`}
                className="flex items-center gap-2.5 rounded bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] transition-colors shrink-0 border border-white/5"
              >
                {isLive ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-[#ED2C25] bg-[#ED2C25]/10 px-1 rounded animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ED2C25]" />
                    {game.time_elapsed || 'LIVE'}
                  </span>
                ) : isFinished ? (
                  <span className="text-[9px] font-semibold text-white/40">FT</span>
                ) : (
                  <span className="text-[9px] font-semibold text-white/60">
                    {game.local_date ? game.local_date.split(' ')[1] : ''}
                  </span>
                )}

                <div className="flex items-center gap-1.5 font-medium text-white/90">
                  <span className="max-w-[70px] truncate">{game.home_team_name_en}</span>
                  {homeFlag && (
                    <img 
                      src={homeFlag} 
                      alt="" 
                      className="h-3 w-4.5 object-cover rounded-sm border border-white/10"
                      loading="lazy"
                    />
                  )}
                  
                  <span className="bg-black/40 px-1.5 py-0.5 rounded text-white font-bold mx-0.5">
                    {game.home_score !== 'null' ? game.home_score : '-'} : {game.away_score !== 'null' ? game.away_score : '-'}
                  </span>

                  {awayFlag && (
                    <img 
                      src={awayFlag} 
                      alt="" 
                      className="h-3 w-4.5 object-cover rounded-sm border border-white/10"
                      loading="lazy"
                    />
                  )}
                  <span className="max-w-[70px] truncate">{game.away_team_name_en}</span>
                </div>

                {game.streamUrl && !isFinished && (
                  <span className="bg-[#FFD700] text-black text-[8px] font-extrabold px-1 rounded">
                    LIVE
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
