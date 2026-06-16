import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Trophy, Play, Search, Info } from 'lucide-react';

export default function WorldCupPortal() {
  const [activeTab, setActiveTab] = useState('matches'); // 'matches', 'standings', 'stadiums'
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [groups, setGroups] = useState([]);
  const [stadiums, setStadiums] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Filters for Matches tab
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState('all'); // 'all', 'live', 'upcoming', 'finished', 'streaming'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch teams, games, groups, stadiums in parallel
      const [teamsRes, gamesRes, groupsRes, stadiumsRes] = await Promise.all([
        fetch('/api/worldcup/teams').then(r => r.json()),
        fetch('/api/worldcup/games').then(r => r.json()),
        fetch('/api/worldcup/groups').then(r => r.json()),
        fetch('/api/worldcup/stadiums').then(r => r.json())
      ]);

      if (!teamsRes.success || !gamesRes.success || !groupsRes.success || !stadiumsRes.success) {
        throw new Error('Không thể tải đầy đủ dữ liệu từ hệ thống.');
      }

      // Map teams
      const teamsMap = {};
      teamsRes.teams.forEach(t => {
        teamsMap[t.id] = t;
      });
      setTeams(teamsMap);

      // Map stadiums
      const stadiumsMap = {};
      stadiumsRes.stadiums.forEach(s => {
        stadiumsMap[s.id] = s;
      });
      setStadiums(stadiumsMap);

      setGames(gamesRes.games || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      console.error('[WorldCup Portal Error]', err);
      setError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredGames = () => {
    return games.filter(game => {
      // Search text matches home or away team
      const homeName = (game.home_team_name_en || '').toLowerCase();
      const awayName = (game.away_team_name_en || '').toLowerCase();
      const query = matchSearchQuery.toLowerCase().trim();
      const matchesText = homeName.includes(query) || awayName.includes(query) || String(game.id).includes(query);

      if (!matchesText) return false;

      // Match Status filters
      const isLive = game.finished !== 'TRUE' && game.time_elapsed !== 'not_started' && game.time_elapsed !== 'notstarted';
      const isFinished = game.finished === 'TRUE';
      const isUpcoming = game.finished !== 'TRUE' && (game.time_elapsed === 'not_started' || game.time_elapsed === 'notstarted');
      const hasStream = !!game.streamUrl;

      if (matchFilter === 'live') return isLive;
      if (matchFilter === 'upcoming') return isUpcoming;
      if (matchFilter === 'finished') return isFinished;
      if (matchFilter === 'streaming') return hasStream && !isFinished;
      
      return true;
    });
  };

  // Helper to format round type
  const formatRoundType = (type) => {
    switch (type) {
      case 'group': return 'Vòng Bảng';
      case 'round_32': return 'Vòng 32 Đội';
      case 'round_16': return 'Vòng 16 Đội';
      case 'quarter_final': return 'Tứ Kết';
      case 'semi_final': return 'Bán Kết';
      case 'third_place': return 'Tranh Hạng 3';
      case 'final': return 'Chung Kết';
      default: return type || 'Vòng Đấu';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ED2C25] border-t-transparent"></div>
        <p className="text-white/60 text-sm">Đang tải dữ liệu World Cup 2026...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center text-white">
        <h2 className="text-xl font-bold text-red-500">Đã xảy ra lỗi</h2>
        <p className="mt-2 text-sm text-white/70">{error}</p>
        <button 
          onClick={fetchData} 
          className="mt-4 rounded bg-[#ED2C25] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-red-950 px-6 py-10 text-white shadow-2xl border border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 text-xs font-bold text-[#FFD700] uppercase tracking-wider mb-3">
            🏆 FIFA World Cup 2026
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-white">
            ĐƯỜNG TỚI CHIẾN THẮNG
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/70">
            Theo dõi trực tiếp lịch thi đấu, bảng xếp hạng realtime, tỷ số các trận đấu đỉnh cao của ngày hội bóng đá lớn nhất hành tinh được tổ chức tại Mỹ, Canada và Mexico.
          </p>
        </div>
        <div className="relative z-10 shrink-0 flex items-center justify-center md:mr-8">
          <img 
            src="https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/330px-2026_FIFA_World_Cup_emblem.svg.png" 
            alt="FIFA World Cup 2026 Emblem" 
            className="h-28 md:h-36 w-auto object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          />
        </div>
        <div className="absolute right-0 bottom-0 top-0 opacity-5 select-none pointer-events-none hidden md:block">
          <span className="text-[120px] font-black text-white/50 tracking-tighter">WC 2026</span>
        </div>
      </div>

      {/* Tabs Controller */}
      <div className="flex border-b border-white/10 gap-2 mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'matches', label: 'Lịch thi đấu & Kết quả', icon: Calendar },
          { id: 'standings', label: 'Bảng xếp hạng', icon: Trophy },
          { id: 'stadiums', label: 'Sân vận động', icon: MapPin }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                isActive 
                  ? 'border-[#ED2C25] text-white bg-white/5' 
                  : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}
      
      {/* 1. MATCHES TAB */}
      {activeTab === 'matches' && (
        <div>
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'live', label: 'Trực tiếp 🔴' },
                { id: 'streaming', label: 'Có luồng phát 📺' },
                { id: 'upcoming', label: 'Sắp diễn ra' },
                { id: 'finished', label: 'Đã kết thúc' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMatchFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    matchFilter === opt.id
                      ? 'bg-[#ED2C25] border-[#ED2C25] text-white'
                      : 'bg-[#171717] border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                type="text"
                placeholder="Tìm quốc gia hoặc ID trận..."
                value={matchSearchQuery}
                onChange={e => setMatchSearchQuery(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-[#171717] py-2 pl-9 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-[#ED2C25]"
              />
            </div>
          </div>

          {/* Matches List Grid */}
          {getFilteredGames().length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#121212] py-16 text-center text-white/50">
              <Info size={36} className="mx-auto text-white/30 mb-2" />
              Không tìm thấy trận đấu nào khớp với điều kiện lọc.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {getFilteredGames().map(game => {
                const isLive = game.finished !== 'TRUE' && game.time_elapsed !== 'not_started' && game.time_elapsed !== 'notstarted';
                const isFinished = game.finished === 'TRUE';
                const isUpcoming = game.finished !== 'TRUE' && (game.time_elapsed === 'not_started' || game.time_elapsed === 'notstarted');
                
                const homeTeam = teams[game.home_team_id];
                const awayTeam = teams[game.away_team_id];
                const stadium = stadiums[game.stadium_id];

                return (
                  <div 
                    key={game.id} 
                    className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all bg-[#121212] ${
                      isLive 
                        ? 'border-[#ED2C25] shadow-lg shadow-[#ED2C25]/5 ring-1 ring-[#ED2C25]/20' 
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Card Header Info */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                      <span className="text-[10px] font-bold text-[#FFD700] uppercase bg-[#FFD700]/10 px-2 py-0.5 rounded">
                        {formatRoundType(game.type)} {game.group ? `• Bảng ${game.group}` : ''}
                      </span>
                      
                      {isLive ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-[#ED2C25] uppercase bg-[#ED2C25]/10 px-2 py-0.5 rounded animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#ED2C25]" />
                          {game.time_elapsed || 'LIVE'}
                        </span>
                      ) : isFinished ? (
                        <span className="text-[10px] font-medium text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded">
                          Hết giờ
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-white/55 bg-white/5 px-2 py-0.5 rounded">
                          Chưa Bắt Đầu • {game.local_date || ''}
                        </span>
                      )}
                    </div>

                    {/* Scores & Team Flags Main Area */}
                    <div className="flex items-center justify-between px-2 py-1">
                      {/* Home Team */}
                      <div className="flex w-[40%] flex-col items-center text-center gap-2">
                        {homeTeam?.flag ? (
                          <img 
                            src={homeTeam.flag} 
                            alt={game.home_team_name_en} 
                            className="h-10 w-15 object-cover rounded shadow-md border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-15 rounded bg-white/5 flex items-center justify-center text-[10px] text-white/30 border border-white/5">?</div>
                        )}
                        <span className="text-sm font-bold truncate max-w-full text-white">{game.home_team_name_en}</span>
                      </div>

                      {/* Middle Score Display */}
                      <div className="flex flex-col items-center justify-center w-[20%] text-center">
                        <div className="text-2xl font-black tracking-wider text-white">
                          {isUpcoming ? (
                            <span className="text-white/30 text-lg">VS</span>
                          ) : (
                            `${game.home_score !== 'null' ? game.home_score : '0'} - ${game.away_score !== 'null' ? game.away_score : '0'}`
                          )}
                        </div>
                        <span className="text-[9px] text-white/30 mt-1">Trận #{game.id}</span>
                      </div>

                      {/* Away Team */}
                      <div className="flex w-[40%] flex-col items-center text-center gap-2">
                        {awayTeam?.flag ? (
                          <img 
                            src={awayTeam.flag} 
                            alt={game.away_team_name_en} 
                            className="h-10 w-15 object-cover rounded shadow-md border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-15 rounded bg-white/5 flex items-center justify-center text-[10px] text-white/30 border border-white/5">?</div>
                        )}
                        <span className="text-sm font-bold truncate max-w-full text-white">{game.away_team_name_en}</span>
                      </div>
                    </div>

                    {/* Scorers info (if any) */}
                    {(game.home_scorers !== 'null' && game.home_scorers || game.away_scorers !== 'null' && game.away_scorers) && (
                      <div className="mt-3 text-[10px] text-white/45 bg-white/5 p-2 rounded flex justify-between gap-4">
                        <div className="w-1/2 text-left truncate">
                          {game.home_scorers !== 'null' ? String(game.home_scorers).replace(/[{""}]/g, '') : ''}
                        </div>
                        <div className="w-1/2 text-right truncate">
                          {game.away_scorers !== 'null' ? String(game.away_scorers).replace(/[{""}]/g, '') : ''}
                        </div>
                      </div>
                    )}

                    {/* Footer Info & Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-1 text-[10px] text-white/40">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate max-w-[150px]">{stadium ? `${stadium.name_en}, ${stadium.city_en}` : 'Đang cập nhật'}</span>
                      </div>

                      {/* Stream Action Button */}
                      {game.streamUrl && !isFinished ? (
                        <a
                          href={`/tv/?matchId=${game.id}`}
                          className="flex items-center gap-1.5 rounded bg-[#ED2C25] hover:bg-red-700 px-3 py-1.5 text-xs font-black text-white uppercase tracking-wider transition-colors shadow-md shadow-[#ED2C25]/20 animate-bounce"
                        >
                          <Play size={11} fill="white" />
                          Xem Trực Tiếp
                        </a>
                      ) : (
                        <a
                          href={`/tv/?matchId=${game.id}`}
                          className="flex items-center gap-1.5 rounded bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 transition-colors border border-white/5"
                        >
                          Phòng chờ & Dự đoán
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. STANDINGS TAB */}
      {activeTab === 'standings' && (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <div key={group.name} className="rounded-xl border border-white/5 bg-[#121212] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 border-b border-white/5 px-4 py-3">
                <h3 className="font-extrabold text-sm text-white">Bảng {group.name}</h3>
              </div>
              
              <div className="p-3 overflow-x-auto">
                <table className="w-full text-left text-xs text-white/80 border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-white/45 text-[10px] uppercase font-bold">
                      <th className="py-2 pl-1">Đội</th>
                      <th className="py-2 text-center w-8">Trận</th>
                      <th className="py-2 text-center w-8">H.Số</th>
                      <th className="py-2 text-center w-10">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.teams && group.teams.map((t, idx) => {
                      const teamDetails = teams[t.team_id];
                      return (
                        <tr key={t.team_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2.5 pl-1 flex items-center gap-2 max-w-[150px] truncate">
                            <span className="w-4 text-[10px] font-bold text-white/30">{idx + 1}</span>
                            {teamDetails?.flag ? (
                              <img 
                                src={teamDetails.flag} 
                                alt={teamDetails.name_en} 
                                className="h-3 w-4.5 object-cover rounded-sm border border-white/10"
                              />
                            ) : (
                              <div className="h-3 w-4.5 bg-white/5 rounded-sm" />
                            )}
                            <span className="font-semibold text-white truncate">{teamDetails?.name_en || `Đội #${t.team_id}`}</span>
                          </td>
                          <td className="py-2.5 text-center font-medium">{t.mp}</td>
                          <td className={`py-2.5 text-center font-medium ${parseInt(t.gd) > 0 ? 'text-green-500' : parseInt(t.gd) < 0 ? 'text-red-500' : ''}`}>
                            {parseInt(t.gd) > 0 ? `+${t.gd}` : t.gd}
                          </td>
                          <td className="py-2.5 text-center font-extrabold text-white">{t.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. STADIUMS TAB */}
      {activeTab === 'stadiums' && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Object.values(stadiums).map(stadium => (
            <div key={stadium.id} className="rounded-xl border border-white/5 bg-[#121212] p-4 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-extrabold text-[#ED2C25] bg-[#ED2C25]/10 px-2 py-0.5 rounded">
                    Sân số #{stadium.id}
                  </span>
                  <span className="text-[10px] font-bold text-white/40">
                    {stadium.region} Region
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-base leading-snug">{stadium.name_en}</h4>
                <p className="text-xs text-white/55 mt-1 font-medium italic">{stadium.fifa_name}</p>
                
                <div className="mt-4 space-y-1.5 text-xs text-white/60">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-white/40 shrink-0" />
                    <span>{stadium.city_en}, {stadium.country_en}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Info size={12} className="text-white/40 shrink-0" />
                    <span>Sức chứa: <strong className="text-white font-bold">{stadium.capacity?.toLocaleString('vi-VN')}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
