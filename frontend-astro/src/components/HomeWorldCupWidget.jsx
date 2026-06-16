import React, { useEffect, useState } from 'react';
import { Play, Trophy, ArrowRight, Calendar } from 'lucide-react';

export default function HomeWorldCupWidget() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch teams for flags lookup
    fetch('/api/worldcup/teams')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.teams) {
          const map = {};
          data.teams.forEach(t => { map[t.id] = t; });
          setTeams(map);
        }
      })
      .catch(err => console.error('Error loading teams for home widget:', err));

    // Fetch and poll games
    const fetchGames = () => {
      fetch('/api/worldcup/games')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.games) {
            // Sort to display:
            // 1. Live games (finished !== 'TRUE' and time_elapsed !== 'not_started')
            // 2. Upcoming games (finished !== 'TRUE')
            // 3. Recently finished games
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
            // Show up to 4 most relevant matches on home widget
            setGames(sorted.slice(0, 4));
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading games for home widget:', err);
          setLoading(false);
        });
    };

    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && games.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(idx => (
          <div key={idx} className="h-32 w-full animate-pulse rounded-xl bg-[#151515] border border-white/5" />
        ))}
      </div>
    );
  }

  if (games.length === 0) return null;

  return (
    <div className="w-full">
      {/* Widget Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map(game => {
          const isLive = game.finished !== 'TRUE' && game.time_elapsed !== 'not_started' && game.time_elapsed !== 'notstarted';
          const isFinished = game.finished === 'TRUE';
          
          const homeTeam = teams[game.home_team_id];
          const awayTeam = teams[game.away_team_id];

          return (
            <div 
              key={game.id} 
              className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all bg-[#121212] ${
                isLive 
                  ? 'border-[#ED2C25]/40 bg-gradient-to-b from-[#ED2C25]/10 to-[#121212] shadow-lg shadow-[#ED2C25]/5' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              {/* Top Row: Matchday & Status */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span className="text-[9px] font-bold text-[#FFD700] uppercase tracking-wider">
                  Trận #{game.id}
                </span>

                {isLive ? (
                  <span className="flex items-center gap-1 text-[9px] font-black text-[#ED2C25] uppercase bg-[#ED2C25]/15 px-2 py-0.5 rounded animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ED2C25]" />
                    {game.time_elapsed || 'LIVE'}
                  </span>
                ) : isFinished ? (
                  <span className="text-[9px] font-bold text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded">
                    FT
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-white/60 bg-white/5 px-2 py-0.5 rounded">
                    Chưa Bắt Đầu
                  </span>
                )}
              </div>

              {/* Match Scoreboard */}
              <div className="flex items-center justify-between px-1 py-1.5">
                {/* Home */}
                <div className="flex w-[40%] flex-col items-center text-center gap-1.5 min-w-0">
                  {homeTeam?.flag ? (
                    <img 
                      src={homeTeam.flag} 
                      alt="" 
                      className="h-7 w-10.5 object-cover rounded shadow border border-white/10"
                    />
                  ) : (
                    <div className="h-7 w-10.5 rounded bg-white/5 border border-white/5" />
                  )}
                  <span className="text-xs font-bold text-white truncate w-full">{game.home_team_name_en}</span>
                </div>

                {/* VS / Score */}
                <div className="flex flex-col items-center justify-center w-[20%] text-center">
                  <div className="text-lg font-black text-white leading-none">
                    {(game.time_elapsed === 'not_started' || game.time_elapsed === 'notstarted') && !isFinished ? (
                      <span className="text-white/30 text-sm">VS</span>
                    ) : (
                      `${game.home_score !== 'null' ? game.home_score : '0'}-${game.away_score !== 'null' ? game.away_score : '0'}`
                    )}
                  </div>
                </div>

                {/* Away */}
                <div className="flex w-[40%] flex-col items-center text-center gap-1.5 min-w-0">
                  {awayTeam?.flag ? (
                    <img 
                      src={awayTeam.flag} 
                      alt="" 
                      className="h-7 w-10.5 object-cover rounded shadow border border-white/10"
                    />
                  ) : (
                    <div className="h-7 w-10.5 rounded bg-white/5 border border-white/5" />
                  )}
                  <span className="text-xs font-bold text-white truncate w-full">{game.away_team_name_en}</span>
                </div>
              </div>

              <div className="mt-3.5 border-t border-white/5 pt-2.5 flex items-center justify-between">
                <span className="text-[9px] text-white/40 truncate max-w-[140px]">
                  {game.local_date || ''}
                </span>

                <a 
                  href={`/tv/?matchId=${game.id}`}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${
                    isLive
                      ? 'bg-[#ED2C25] hover:bg-red-700 text-white shadow shadow-[#ED2C25]/20 animate-bounce'
                      : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/5'
                  }`}
                >
                  <Play size={9} fill="currentColor" />
                  {isLive ? 'Xem Live' : 'Phòng chờ'}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
