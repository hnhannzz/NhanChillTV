import React, { useEffect, useState } from 'react';
import { CalendarDays, Play, Video } from 'lucide-react';

export default function HomeEvents({ showEmpty = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/events');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      setEvents((data.data || [])
        .filter(event => event.status !== 'ended')
        .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0)));
    } catch (err) {
      setError('Không thể tải danh sách sự kiện.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  if (loading) {
    return <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="aspect-video animate-pulse rounded-lg bg-white/5" />)}</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-white/5 bg-[#151515] p-8 text-center text-sm text-white/55"><p>{error}</p><button onClick={fetchEvents} className="mt-3 rounded-md bg-[#ED2C25] px-4 py-2 font-bold text-white">Thử lại</button></div>;
  }

  if (!events.length) {
    return showEmpty ? (
      <div className="rounded-lg border border-white/5 bg-[#151515] px-6 py-16 text-center">
        <CalendarDays className="mx-auto mb-4 text-white/25" size={42} />
        <h2 className="font-bold text-white">Chưa có sự kiện sắp diễn ra</h2>
        <p className="mt-2 text-sm text-white/50">Lịch phát trực tiếp sẽ xuất hiện tại đây khi được cập nhật.</p>
      </div>
    ) : null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {events.map(event => {
        const channelQuery = event.sourceType === 'iptv' && event.sourceChannelId
          ? `&channel=${encodeURIComponent(event.sourceChannelId)}`
          : '';
        return (
          <a key={event.id} href={`/tv/?event=${encodeURIComponent(event.id)}${channelQuery}`} className="group overflow-hidden rounded-lg border border-white/5 bg-[#121212] transition-colors hover:border-[#ED2C25]/55">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/50">
              {event.thumbnailUrl || event.thumbnailBase64 ? (
                <img src={event.thumbnailUrl || event.thumbnailBase64} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center"><Video size={42} className="text-white/20" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <span className={`absolute left-3 top-3 rounded px-2 py-1 text-[10px] font-bold tracking-wide text-white ${event.status === 'live' ? 'bg-red-600' : 'bg-blue-600'}`}>{event.status === 'live' ? 'TRỰC TIẾP' : 'SẮP DIỄN RA'}</span>
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ED2C25]"><Play size={21} fill="currentColor" className="ml-0.5 text-white" /></span></span>
            </div>
            <div className="p-3.5 sm:p-4">
              <h3 className="line-clamp-2 font-bold text-white group-hover:text-[#ED2C25]">{event.title}</h3>
              <div className="mt-2 text-xs text-white/50">{event.time ? new Date(event.time).toLocaleString('vi-VN') : 'Chưa xác định thời gian'}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
