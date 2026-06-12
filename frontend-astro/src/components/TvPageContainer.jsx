import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Heart, Radio, Search } from 'lucide-react';
import LivePlayerView from './LivePlayerView';
import EventChat from './EventChat';
import { getBrowserEpgSchedule } from '../lib/browserEpg';

const API_BASE = '/api';

export default function TvPageContainer() {
  const [channels, setChannels] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const [streamParam, setStreamParam] = useState(null);
  const [eventId, setEventId] = useState(() => new URLSearchParams(window.location.search).get('event'));
  const [eventData, setEventData] = useState(null);
  const [activeEventStream, setActiveEventStream] = useState(0);
  const [epgData, setEpgData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    let frame = 0;
    const handleScroll = () => {
      if (!mainContainer || frame) return;
      frame = requestAnimationFrame(() => {
        const currentScrollY = mainContainer.scrollTop;
        const delta = currentScrollY - lastScrollY.current;
        // Dead-zone: only change direction when scroll delta > 5px (synced with Header)
        if (Math.abs(delta) > 5) {
          const hidden = delta > 0 && currentScrollY > 50;
          setIsHeaderHidden(current => current === hidden ? current : hidden);
        }
        lastScrollY.current = currentScrollY;
        frame = 0;
      });
    };
    mainContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      mainContainer?.removeEventListener('scroll', handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let initialChannelId = params.get('channel');
    let initialStreamUrl = params.get('stream');
    const initialEventId = params.get('event');
    setEventId(initialEventId);

    const load = async () => {
      try {
        const channelsRes = await fetch(`${API_BASE}/iptv/channels`);
        const channelsData = await channelsRes.json();
        if (!channelsRes.ok || !channelsData.success) throw new Error(channelsData.error || `HTTP ${channelsRes.status}`);
        const loadedChannels = Array.isArray(channelsData.data) ? channelsData.data : [];
        setChannels(loadedChannels);

        if (initialEventId) {
          const eventsRes = await fetch(`${API_BASE}/admin/events`);
          const eventsData = await eventsRes.json();
          const event = eventsData.success ? eventsData.data.find(item => item.id === initialEventId) : null;
          if (event) {
            const streams = event.streams?.length ? event.streams : [{ id: 'primary', name: 'Luồng chính', sourceType: event.sourceType, sourceChannelId: event.sourceChannelId, stream: event.stream }];
            setEventData({ ...event, streams });
            const firstStream = streams[0];
            if (firstStream?.sourceType === 'iptv' && firstStream.sourceChannelId) {
              initialChannelId = firstStream.sourceChannelId;
              initialStreamUrl = null;
            } else if (firstStream?.stream) {
              initialStreamUrl = firstStream.stream;
              initialChannelId = null;
            }
          }
        }

        if (initialChannelId) setCurrentChannelId(initialChannelId);
        if (initialStreamUrl) setStreamParam(initialStreamUrl);
        if (!initialEventId && !initialChannelId && !initialStreamUrl && loadedChannels.length) setCurrentChannelId(loadedChannels[0].id);

        const token = localStorage.getItem('userToken');
        if (token) {
          const favoritesRes = await fetch(`${API_BASE}/user/favorites`, { headers: { 'x-user-id': token } });
          const favoritesData = await favoritesRes.json();
          if (favoritesData.success) setFavorites(favoritesData.data.channels || []);
        }
      } catch (err) {
        console.error('[TV] Load failed:', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!currentChannelId || eventId) {
      setEpgData(null);
      return;
    }
    const currentChannel = channels.find(channel => channel.id === currentChannelId);
    const params = new URLSearchParams({ limit: '18' });
    if (currentChannel?.name) params.set('name', currentChannel.name);
    let cancelled = false;
    setEpgData(null);

    const loadEpg = async () => {
      try {
        const schedule = await getBrowserEpgSchedule(currentChannelId, currentChannel?.name, 18);
        if (!cancelled) setEpgData(schedule);
      } catch (browserError) {
        console.info('[TV] Direct browser EPG fetch unavailable, using same-source fallback:', browserError.message);
        try {
          const response = await fetch(`${API_BASE}/epg/${encodeURIComponent(currentChannelId)}?${params}`);
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
          if (!cancelled) setEpgData({ ...data.data, transport: 'server-fallback' });
        } catch (fallbackError) {
          console.warn('[TV] EPG unavailable:', fallbackError.message);
        }
      }
    };

    loadEpg();
    return () => { cancelled = true; };
  }, [channels, currentChannelId, eventId]);

  const selectEventStream = index => {
    const stream = eventData?.streams?.[index];
    if (!stream) return;
    setActiveEventStream(index);
    if (stream.sourceType === 'iptv') {
      setCurrentChannelId(stream.sourceChannelId || null);
      setStreamParam(null);
    } else {
      setCurrentChannelId(null);
      setStreamParam(stream.stream || null);
    }
  };

  const playChannel = (id) => {
    setCurrentChannelId(id);
    setStreamParam(null);
    setEventId(null);
    window.history.pushState({}, '', `?channel=${encodeURIComponent(id)}`);
    document.getElementById('main-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavoriteChannel = async (id, event) => {
    event.stopPropagation();
    const token = localStorage.getItem('userToken');
    if (!token) return alert('Vui lòng đăng nhập để lưu kênh yêu thích.');
    try {
      const response = await fetch(`${API_BASE}/user/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': token },
        body: JSON.stringify({ type: 'channels', itemId: id }),
      });
      const data = await response.json();
      if (data.success) setFavorites(data.data.channels || []);
    } catch (err) {
      console.error('[TV] Favorite update failed:', err);
    }
  };

  const groups = useMemo(() => [...new Set(channels.map(channel => channel.group).filter(Boolean))], [channels]);
  const filteredChannels = useMemo(() => channels.filter(channel => {
    if (filter === 'favorites' && !favorites.includes(channel.id)) return false;
    if (!['all', 'favorites'].includes(filter) && channel.group !== filter) return false;
    return !search || channel.name.toLowerCase().includes(search.toLowerCase());
  }), [channels, favorites, filter, search]);

  const currentChannel = channels.find(channel => channel.id === currentChannelId);
  const epgPrograms = Array.isArray(epgData?.programs) ? epgData.programs : [];
  const isCurrentProgram = program => Date.now() >= program.start && Date.now() < program.stop;
  const formatTime = value => value
    ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const epgSourceLabel = useMemo(() => {
    try {
      return epgData?.source ? new URL(epgData.source).hostname.replace(/^www\./, '') : 'EPG server';
    } catch {
      return 'EPG server';
    }
  }, [epgData?.source]);
  const eventHeading = eventData && (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#ED2C25]"><Radio size={14} /> {eventData.status === 'live' ? 'Đang trực tiếp' : 'Sắp diễn ra'}</div>
        <h1 className="mt-1 truncate text-xl font-black text-white md:text-2xl">{eventData.title}</h1>
      </div>
      {eventData.streams.length > 1 && <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{eventData.streams.map((stream, index) => <button key={stream.id || index} onClick={() => selectEventStream(index)} className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${activeEventStream === index ? 'bg-[#ED2C25] text-white' : 'bg-white/8 text-white/65 hover:bg-white/12'}`}>{stream.name || `Luồng ${index + 1}`}</button>)}</div>}
    </div>
  );

  if (eventId) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-0 pb-8 pt-0 lg:px-8 lg:pt-6">
        <div className="hidden lg:block">{eventHeading}</div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)]">
          <div className={`fixed left-0 right-0 z-50 w-full overflow-hidden bg-black shadow-2xl transition-[top] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:static lg:z-auto lg:rounded-lg lg:border lg:border-white/10 ${isHeaderHidden ? 'top-0' : 'top-[64px]'}`} style={{ willChange: 'top' }}>
            {(currentChannelId || streamParam) ? <LivePlayerView key={`${currentChannelId || streamParam}-${activeEventStream}`} channelId={currentChannelId} streamParam={streamParam} /> : <div className="flex aspect-video items-center justify-center text-sm text-white/45">Đang chờ nguồn phát sự kiện...</div>}
          </div>
          <div className="aspect-video w-full lg:hidden" />
          <div className="px-4 lg:hidden">{eventHeading}</div>
          <div className="px-4 lg:px-0">
            <EventChat eventId={eventId} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-0 pb-8 pt-0 md:px-8 md:pt-8">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)]">
        <div className={`fixed left-0 right-0 z-50 w-full overflow-hidden bg-black shadow-2xl transition-[top] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:static lg:z-auto lg:rounded-lg lg:border lg:border-white/10 ${isHeaderHidden ? 'top-0' : 'top-[64px]'}`} style={{ willChange: 'top' }}>
          {(currentChannelId || streamParam) ? (
            <LivePlayerView key={currentChannelId || streamParam} channelId={currentChannelId} streamParam={streamParam} />
          ) : (
            <div className="aspect-video w-full animate-pulse bg-[#121212]" />
          )}
        </div>

        <div className="block aspect-video w-full lg:hidden" />

        <aside className="mx-4 lg:mx-0 flex h-[330px] min-h-0 w-auto lg:w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151515] lg:h-[420px] xl:h-[460px]">
          <div className="border-b border-white/10 bg-[#101010] px-4 py-3">
            <div className="truncate font-bold text-white">Lịch phát sóng</div>
            <div className="truncate text-xs text-white/45">{currentChannel?.name || epgData?.channel?.name || 'Đang chọn kênh'}</div>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 bg-[#ED2C25]/10 px-3 py-1.5 text-xs font-bold text-[#ED2C25]">
            <span>Hôm nay</span>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
            {epgPrograms.length ? epgPrograms.map((program, index) => {
              const active = isCurrentProgram(program);
              return (
                <div key={`${program.start}-${index}`} className={`flex min-h-11 items-center gap-2.5 border-b border-white/5 px-2 py-2 last:border-0 ${active ? 'rounded-md bg-[#ED2C25]/15 text-white' : 'text-white/60'}`}>
                  <div className={`w-[44px] shrink-0 text-xs font-bold ${active ? 'text-[#ED2C25]' : 'text-white/45'}`}>{formatTime(program.start)}</div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[13px] ${active ? 'font-bold text-white' : 'font-medium'}`}>{program.title}</div>
                    {active && program.desc && <div className="mt-0.5 truncate text-[11px] text-white/40">{program.desc}</div>}
                  </div>
                </div>
              );
            }) : (
              <div className="flex h-full flex-col items-center justify-center text-white/30">
                <Clock size={30} className="mb-2" />
                <span className="text-sm">Không có lịch phát sóng</span>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 bg-[#101010] px-4 py-2 text-center text-[10px] text-white/40">
            Lịch phát sóng cung cấp bởi: <span className="text-[#ED2C25] font-semibold">{epgSourceLabel}</span>
          </div>
        </aside>
      </div>

      <div className="px-4 md:px-0 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto snap-x">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</FilterButton>
            <FilterButton active={filter === 'favorites'} onClick={() => setFilter('favorites')}>Yêu thích</FilterButton>
            {groups.map(group => <FilterButton key={group} active={filter === group} onClick={() => setFilter(group)}>{group}</FilterButton>)}
          </div>
          <div className="relative w-full shrink-0 md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kiếm kênh" className="w-full rounded-md border border-white/15 bg-[#151515] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#ED2C25]" />
          </div>
        </div>

        {filteredChannels.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredChannels.map(channel => (
              <ChannelCard key={channel.id} channel={channel} active={currentChannelId === channel.id} favorite={favorites.includes(channel.id)} onPlay={playChannel} onFavorite={toggleFavoriteChannel} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-white/5 bg-[#151515] py-16 text-center text-white/50">Không tìm thấy kênh phù hợp.</div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button 
      onClick={onClick} 
      className={`snap-start shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all ${active ? 'bg-[#ED2C25] text-white shadow-[0_0_15px_rgba(237,44,37,0.4)]' : 'bg-[#1A1A1A] border border-white/10 text-white/60 hover:bg-[#252525] hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function ChannelCard({ channel, active, favorite, onPlay, onFavorite }) {
  return (
    <button onClick={() => onPlay(channel.id)} className={`group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border bg-[#171717] p-4 transition-colors ${active ? 'border-[#ED2C25]' : 'border-white/5 hover:border-white/20'}`}>
      <img src={channel.logo || '/poster.jpg'} alt={channel.name} className="h-3/4 w-3/4 object-contain transition-transform group-hover:scale-105" onError={event => { event.currentTarget.src = '/poster.jpg'; }} />
      <span onClick={event => onFavorite(channel.id, event)} className={`absolute right-2 top-2 rounded-md bg-black/55 p-1.5 ${favorite ? 'text-[#ED2C25]' : 'text-white/40 opacity-0 group-hover:opacity-100'}`} title="Yêu thích">
        <Heart size={14} fill={favorite ? 'currentColor' : 'none'} />
      </span>
      <span className="absolute bottom-1.5 left-2 right-2 truncate text-center text-[11px] font-medium text-white/70">{channel.name}</span>
    </button>
  );
}
