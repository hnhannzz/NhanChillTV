import React, { useState, useEffect } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

export default function HomeChannels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useDraggableScroll();

  const fetchChannels = () => {
    setLoading(true);
    setError(null);
    fetch('/api/iptv/channels?fields=id,name,group,logo&limit=50')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const featuredIds = ['vtv1hd', 'vtv2hd', 'vtv3hd', 'vtv4hd', 'vtv5hd', 'vtv6hd', 'htv7hd', 'htv9hd', 'vinhlong1hd', 'vinhlong2hd'];
          const featured = data.data.filter(c => featuredIds.includes(c.id));
          featured.sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id));
          setChannels(featured.length > 0 ? featured : data.data.slice(0, 10));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Không thể tải danh sách kênh');
        setLoading(false);
      });
  };

  useEffect(fetchChannels, []);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className="min-w-[200px] md:min-w-[280px] h-[120px] bg-white/5 rounded-xl animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-[#1A1A1A] rounded-xl border border-white/5">
        <p className="text-white/50 text-sm mb-3">{error}</p>
        <button onClick={fetchChannels} className="px-4 py-2 bg-[#ED2C25] text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
          Thử lại
        </button>
      </div>
    );
  }

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -600, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 600, behavior: 'smooth' });
  };

  return (
    <div className="relative group/nav">
      {/* Left Arrow */}
      <button 
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-24 bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover/nav:opacity-100 transition-opacity backdrop-blur-sm hidden md:flex"
      >
        <ChevronLeft size={32} />
      </button>

      <div 
        ref={scrollRef}
        className="mobile-horizontal-scroll flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-proximity cursor-grab py-2 select-none px-4 md:snap-mandatory md:px-0"
        onDragStart={(e) => e.preventDefault()}
      >
        {channels.map(channel => (
        <a key={channel.id} href={`/tv/?channel=${channel.id}`} className="group relative rounded-xl overflow-hidden aspect-video bg-[#1A1A1A] border border-white/5 hover:border-[#ED2C25]/50 transition-all min-w-[160px] md:min-w-[200px] shrink-0 snap-start" draggable="false">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <img src={channel.logo || '/poster.jpg'} alt={channel.name} className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" onError={(e) => { if(!e.currentTarget.src.includes('/poster.jpg')) { e.currentTarget.src = '/poster.jpg'; } }} draggable="false" />
          </div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
            <div className="w-12 h-12 rounded-full bg-[#ED2C25] flex items-center justify-center text-white scale-50 group-hover:scale-100 transition-all duration-300 delay-100">
              <Play size={20} fill="currentColor" />
            </div>
          </div>
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-[10px] font-bold text-white rounded animate-pulse">
            LIVE
          </div>
        </a>
      ))}
      </div>

      {/* Right Arrow */}
      <button 
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-24 bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover/nav:opacity-100 transition-opacity backdrop-blur-sm hidden md:flex"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
}
