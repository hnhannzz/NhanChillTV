import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info } from 'lucide-react';
import MovieModal from './MovieModal';

export default function HeroBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalSlug, setModalSlug] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/events').then(res => res.json()).catch(() => ({ success: false })),
      fetch('https://phim.nguonc.com/api/films/phim-moi-cap-nhat').then(res => res.json()).catch(() => ({ status: 'error' }))
    ]).then(([eventsData, moviesData]) => {
      let combined = [];
      
      if (eventsData.success) {
        const pinned = eventsData.data.filter(e => e.isPinned);
        combined = [...combined, ...pinned.map(e => ({
          type: 'event',
          slug: e.id,
          name: e.title,
          original_name: 'Sự kiện nổi bật',
          description: e.description || 'Sự kiện thể thao/giải trí đặc biệt không thể bỏ lỡ.',
          poster_url: e.thumbnailUrl || e.thumbnailBase64 || '/poster.jpg',
          quality: e.status === 'live' ? 'LIVE' : 'SỰ KIỆN',
          channelId: e.sourceChannelId || 'custom'
        }))];
      }

      if (moviesData.status === 'success') {
        const movies = (moviesData.items || moviesData.data.items).slice(0, 5).map(m => ({
          type: 'movie',
          ...m
        }));
        combined = [...combined, ...movies];
      }

      setSlides(combined.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [slides]);

  if (loading) {
    return <div className="w-full h-[60vh] md:h-[80vh] bg-[#0A0A0A] animate-pulse"></div>;
  }

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

  const handlePanEnd = (event, info) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (info.offset.x > swipeThreshold) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  return (
    <motion.div 
      className="relative w-full h-[60vh] md:h-[80vh] bg-black overflow-hidden group select-none"
      onContextMenu={(e) => e.preventDefault()}
      onPanEnd={handlePanEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/40 to-transparent z-10" />
          <img 
            src={currentSlide.poster_url || currentSlide.thumb_url} 
            alt={currentSlide.name}
            className="w-full h-full object-cover opacity-60"
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 md:px-12 pb-16 md:pb-32 w-full md:w-2/3">
        <motion.div
          key={`content-${currentIndex}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 mb-2 md:mb-4 text-[10px] md:text-xs font-semibold tracking-wider text-white bg-[#ED2C25] rounded-full">
            {currentSlide.quality || 'Phim Mới'}
          </span>
          <h1 className="text-2xl md:text-6xl font-black text-white mb-1 md:mb-2 leading-tight line-clamp-2">
            {currentSlide.name}
          </h1>
          <h2 className="text-sm md:text-2xl font-bold text-white/60 mb-2 md:mb-4">
            {currentSlide.original_name}
          </h2>
          <p 
            className="text-white/80 text-xs md:text-lg mb-4 md:mb-8 line-clamp-3 md:line-clamp-4 max-w-3xl"
            dangerouslySetInnerHTML={{ __html: currentSlide.description || 'Phim đang được cập nhật trên hệ thống. Hãy xem ngay để không bỏ lỡ những tình tiết hấp dẫn nhất!' }}
          />
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (currentSlide.type === 'event') {
                  window.location.href = `/tv/?channel=${currentSlide.channelId}&event=${currentSlide.slug}`;
                } else {
                  window.location.href = `/movie-detail/?slug=${currentSlide.slug}`;
                }
              }}
              className="flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-[#ED2C25] hover:bg-red-700 transition-colors rounded-lg text-white font-bold text-sm md:text-base shadow-lg shadow-red-500/20"
            >
              <Play fill="currentColor" size={20} />
              Xem Ngay
            </button>
            {currentSlide.type === 'movie' && (
              <button 
                onClick={() => setModalSlug(currentSlide.slug)}
                className="flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-white/20 hover:bg-white/30 backdrop-blur-md transition-colors rounded-lg text-white font-bold text-sm md:text-base"
              >
                <Info size={20} />
                Chi Tiết
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-8 right-8 md:right-12 z-20 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-8 bg-[#ED2C25]' : 'w-4 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>

      {modalSlug && (
        <MovieModal slug={modalSlug} onClose={() => setModalSlug(null)} />
      )}
    </motion.div>
  );
}
