import React, { useState, useEffect } from 'react';
import { Video, ChevronRight, Play } from 'lucide-react';

export default function HomeEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = () => {
    setLoading(true);
    setError(null);
    let isMounted = true;
    fetch('/api/admin/events')
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(data => {
        if (isMounted && data.success) {
          const activeEvents = data.data
            .filter(e => e.status !== 'ended')
            .sort((a, b) => new Date(a.time) - new Date(b.time));
          setEvents(activeEvents);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        if (isMounted) {
          setError('Không thể tải sự kiện');
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  };

  useEffect(fetchEvents, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="aspect-video bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-[#1A1A1A] rounded-xl border border-white/5">
        <p className="text-white/50 text-sm mb-3">{error}</p>
        <button onClick={fetchEvents} className="px-4 py-2 bg-[#ED2C25] text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
          Thử lại
        </button>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {events.map((event) => (
        <a 
          key={event.id}
          href={`/tv?channel=${event.sourceChannelId || 'custom'}&event=${event.id}`}
          className="group block relative bg-[#121212] rounded-2xl overflow-hidden border border-white/5 hover:border-[#ED2C25]/50 transition-all duration-300"
        >
          <div className="aspect-video relative overflow-hidden bg-black/50">
            {event.thumbnailUrl || event.thumbnailBase64 ? (
              <img 
                src={event.thumbnailUrl || event.thumbnailBase64} 
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video size={48} className="text-white/20" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            
            <div className="absolute top-3 left-3 flex gap-2">
              {event.status === 'live' ? (
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-600/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  TRỰC TIẾP
                </span>
              ) : (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded tracking-wider">
                  SẮP DIỄN RA
                </span>
              )}
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full bg-[#ED2C25] flex items-center justify-center shadow-[0_0_20px_rgba(237,44,37,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                <Play className="text-white ml-1" size={24} fill="currentColor" />
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <h3 className="text-white font-bold text-lg leading-tight mb-2 group-hover:text-[#ED2C25] transition-colors line-clamp-2">
              {event.title}
            </h3>
            <div className="flex items-center text-sm text-white/50">
              <span>{new Date(event.time).toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
