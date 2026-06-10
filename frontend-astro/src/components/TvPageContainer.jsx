import React, { useEffect, useRef, useState } from 'react';
import { Clock, Search } from 'lucide-react';
import LivePlayerView from './LivePlayerView';

const API_BASE = '/api';

export default function TvPageContainer() {
  const [channels, setChannels] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const [streamParam, setStreamParam] = useState(null);
  const [epgData, setEpgData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    const handleScroll = () => {
      if (!mainContainer) return;
      const currentScrollY = mainContainer.scrollTop;
      const isScrolled = currentScrollY > 0;
      const scrollDir = currentScrollY > lastScrollY.current ? 'down' : 'up';

      setIsHeaderHidden(isScrolled && scrollDir === 'down');
      lastScrollY.current = currentScrollY;
    };

    mainContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('channel');
    const sUrl = params.get('stream');
    const eId = params.get('event');

    let initialChannelId = cId;
    let initialStreamUrl = sUrl;

    const loadChannels = async () => {
      try {
        const channelsRes = await fetch(`${API_BASE}/iptv/channels`);
        if (!channelsRes.ok) throw new Error(`HTTP ${channelsRes.status}`);
        const channelsData = await channelsRes.json();
        if (channelsData.success) setChannels(channelsData.data);

        if (eId) {
          try {
            const evRes = await fetch(`${API_BASE}/admin/events`);
            if (!evRes.ok) throw new Error(`HTTP ${evRes.status}`);
            const evData = await evRes.json();
            if (evData.success) {
              const event = evData.data.find(e => e.id === eId);
              if (event && (event.sourceType === 'custom' || event.sourceType === 'obs')) {
                initialStreamUrl = event.stream;
                initialChannelId = null;
              }
            }
          } catch (e) {
            console.error('Error loading event:', e);
          }
        }

        if (initialChannelId) setCurrentChannelId(initialChannelId);
        if (initialStreamUrl) setStreamParam(initialStreamUrl);

        if (!initialChannelId && !initialStreamUrl && channelsData.data?.length > 0) {
          setCurrentChannelId(channelsData.data[0].id);
        }

        const token = localStorage.getItem('userToken');
        if (token) {
          try {
            const favRes = await fetch(`${API_BASE}/user/favorites`, {
              headers: { 'x-user-id': token },
            });
            if (favRes.ok) {
              const favData = await favRes.json();
              if (favData.success) setFavorites(favData.data.channels || []);
            }
          } catch (e) {
            console.error('Error loading favorites:', e);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadChannels();
  }, []);

  useEffect(() => {
    if (!currentChannelId) {
      setEpgData(null);
      return;
    }

    const currentChannel = channels.find(c => c.id === currentChannelId);
    const params = new URLSearchParams({ limit: '36' });
    if (currentChannel?.name) params.set('name', currentChannel.name);

    setEpgData(null);
    fetch(`${API_BASE}/epg/${encodeURIComponent(currentChannelId)}?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.success) setEpgData(data.data);
      })
      .catch(err => console.error('EPG fetch error:', err));
  }, [channels, currentChannelId]);

  const playChannel = (id) => {
    setCurrentChannelId(id);
    setStreamParam(null);
    window.history.pushState({}, '', `?channel=${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavoriteChannel = async (id, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('userToken');
    if (!token) {
      alert('Vui lòng đăng nhập để lưu kênh yêu thích!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/user/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': token },
        body: JSON.stringify({ type: 'channels', itemId: id }),
      });
      const data = await res.json();
      if (data.success) setFavorites(data.data.channels || []);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredChannels = channels.filter(c => {
    if (filter === 'favorites' && !favorites.includes(c.id)) return false;
    if (filter !== 'all' && filter !== 'favorites' && c.group !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groups = [...new Set(channels.map(c => c.group))];
  const currentChannel = channels.find(c => c.id === currentChannelId);
  const epgPrograms = Array.isArray(epgData?.programs) ? epgData.programs : [];
  const formatEpgTime = (value) => value
    ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const isCurrentProgram = (program) => {
    const now = Date.now();
    return now >= program.start && now < program.stop;
  };

  return (
    <div className="flex flex-col gap-6 pt-2 md:pt-6 px-4 md:px-8 pb-8 mt-2 md:mt-8 relative">
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,700px)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,760px)_minmax(360px,1fr)] gap-6 items-start">
          <div className={`w-full bg-[#0A0A0A] rounded-xl overflow-hidden border border-white/10 shadow-2xl relative
            fixed left-0 right-0 z-50 lg:static lg:z-auto transition-all duration-500
            ${isHeaderHidden ? 'top-0' : 'top-[64px]'} lg:top-auto
          `}>
            {(currentChannelId || streamParam) ? (
              <LivePlayerView
                key={currentChannelId || streamParam}
                channelId={currentChannelId}
                streamParam={streamParam}
              />
            ) : (
              <div className="w-full aspect-video bg-[#121212] animate-pulse border border-white/5" />
            )}
          </div>

          <div className="block lg:hidden w-full aspect-video" />

          <div className="w-full bg-[#1A1A1A] rounded-xl border border-white/5 flex flex-col h-[420px] lg:h-[428px] xl:h-[456px] lg:sticky lg:top-24 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-[#121212] rounded-t-xl">
              <div className="font-bold text-white truncate">Lịch phát sóng</div>
              <div className="text-xs text-white/45 truncate">{currentChannel?.name || epgData?.channel?.name || 'Đang chọn kênh'}</div>
            </div>
            <div className="px-4 py-2 border-b border-white/10 flex justify-between items-center bg-[#ED2C25]/10 text-[#ED2C25]">
              <span className="text-sm font-bold">Hôm nay</span>
              <span className="text-xs text-white/45">{epgData?.updatedAt ? `EPG ${new Date(epgData.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'vnepg.site'}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {epgPrograms.length > 0 ? (
                <div className="space-y-2">
                  {epgPrograms.map((program, idx) => {
                    const active = isCurrentProgram(program);
                    return (
                      <div
                        key={`${program.start}-${idx}`}
                        className={`flex gap-3 rounded-lg border p-3 transition-colors ${active ? 'bg-[#ED2C25]/15 border-[#ED2C25]/50 text-white' : 'bg-white/[0.03] border-white/5 text-white/60'}`}
                      >
                        <div className={`w-[52px] shrink-0 text-sm font-bold ${active ? 'text-[#ED2C25]' : 'text-white/50'}`}>
                          {formatEpgTime(program.start)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-[#ED2C25] animate-pulse shrink-0" />}
                            <div className={`truncate text-sm ${active ? 'font-bold text-white' : 'font-medium'}`}>{program.title}</div>
                          </div>
                          {program.desc && <div className="mt-1 line-clamp-2 text-xs text-white/45">{program.desc}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <Clock size={32} className="mb-2 opacity-50" />
                  <span className="text-sm">Không có lịch phát sóng</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
          <div className="flex gap-6 overflow-x-auto pb-2 snap-x custom-scrollbar w-full md:w-auto">
            <button onClick={() => setFilter('all')} className={`snap-start shrink-0 text-lg font-bold pb-1 transition-all border-b-2 ${filter === 'all' ? 'text-white border-[#ED2C25]' : 'text-white/50 border-transparent hover:text-white/80'}`}>Tất cả</button>
            <button onClick={() => setFilter('favorites')} className={`snap-start shrink-0 text-lg font-bold pb-1 transition-all border-b-2 ${filter === 'favorites' ? 'text-white border-[#ED2C25]' : 'text-white/50 border-transparent hover:text-white/80'}`}>Yêu thích</button>
            {groups.map(g => (
              <button key={g} onClick={() => setFilter(g)} className={`snap-start shrink-0 text-lg font-bold pb-1 transition-all border-b-2 ${filter === g ? 'text-white border-[#ED2C25]' : 'text-white/50 border-transparent hover:text-white/80'}`}>{g}</button>
            ))}
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <input
              type="text"
              placeholder="Tìm kiếm kênh"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent border border-white/20 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#ED2C25] text-white transition-colors"
            />
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
          </div>
        </div>

        <div className="flex flex-col gap-8 mt-2">
          {filteredChannels.length === 0 ? (
            <div className="text-center text-white/50 py-20 text-lg bg-[#1A1A1A] rounded-xl border border-white/5">Không tìm thấy kênh nào</div>
          ) : filter === 'all' ? (
            <>
              {favorites.length > 0 && !search && (
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">Yêu thích</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {channels.filter(c => favorites.includes(c.id)).map(ch => (
                      <ChannelCard key={ch.id} ch={ch} currentChannelId={currentChannelId} playChannel={playChannel} favorites={favorites} toggleFavoriteChannel={toggleFavoriteChannel} />
                    ))}
                  </div>
                </div>
              )}
              {groups.map(g => {
                const groupChannels = filteredChannels.filter(c => c.group === g);
                if (groupChannels.length === 0) return null;
                return (
                  <div key={g}>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">{g}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {groupChannels.map(ch => (
                        <ChannelCard key={ch.id} ch={ch} currentChannelId={currentChannelId} playChannel={playChannel} favorites={favorites} toggleFavoriteChannel={toggleFavoriteChannel} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : filter === 'favorites' ? (
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">Yêu thích</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredChannels.map(ch => (
                  <ChannelCard key={ch.id} ch={ch} currentChannelId={currentChannelId} playChannel={playChannel} favorites={favorites} toggleFavoriteChannel={toggleFavoriteChannel} />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">{filter}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredChannels.map(ch => (
                  <ChannelCard key={ch.id} ch={ch} currentChannelId={currentChannelId} playChannel={playChannel} favorites={favorites} toggleFavoriteChannel={toggleFavoriteChannel} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ ch, currentChannelId, playChannel, favorites, toggleFavoriteChannel }) {
  const isCurrent = currentChannelId === ch.id;
  const isFavorite = favorites.includes(ch.id);

  return (
    <button
      onClick={() => playChannel(ch.id)}
      className={`relative w-full aspect-[16/10] bg-[#1A1A1A] rounded-xl flex items-center justify-center p-4 transition-all group overflow-hidden border ${isCurrent ? 'border-[#ED2C25] ring-1 ring-[#ED2C25] shadow-[0_0_20px_rgba(237,44,37,0.3)]' : 'border-white/5 hover:border-white/20 hover:bg-[#222]'}`}
    >
      <img
        src={ch.logo || '/poster.jpg'}
        alt={ch.name}
        className={`w-3/4 h-3/4 object-contain transition-transform duration-300 ${isCurrent ? 'scale-110' : 'group-hover:scale-110'}`}
        onError={(e) => {
          if (!e.currentTarget.src.includes('/poster.jpg')) e.currentTarget.src = '/poster.jpg';
        }}
      />

      <div
        onClick={(e) => toggleFavoriteChannel(ch.id, e)}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${isFavorite ? 'text-[#ED2C25] bg-black/50' : 'text-white/30 opacity-0 group-hover:opacity-100 hover:text-white/80 bg-black/30 hover:bg-black/60'}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>

      {ch.name.toLowerCase().includes('hd') && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#ED2C25] rounded text-[9px] font-black tracking-wider shadow-lg">HD</div>
      )}

      {isCurrent && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
          <span className="w-1.5 h-1.5 bg-[#ED2C25] rounded-full animate-pulse shadow-[0_0_5px_#ED2C25]" />
        </div>
      )}
    </button>
  );
}
