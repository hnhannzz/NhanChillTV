import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Play } from 'lucide-react';
import MovieModal from './MovieModal';
import { fetchNguoncJson, getNguoncItems, getOPhimImageUrl } from '../lib/nguoncApi';

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function HeroBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalSlug, setModalSlug] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/admin/events').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetchNguoncJson('/popular').catch(() => fetchNguoncJson('/danh-sach/phim-moi-cap-nhat')),
    ]).then(([eventsResult, moviesResult]) => {
      const pinnedEvents = eventsResult.status === 'fulfilled' && eventsResult.value.success
        ? eventsResult.value.data
          .filter(event => event.isPinned && event.status !== 'ended')
          .map(event => ({
            ...event,
            isEvent: true,
            name: event.title,
            original_name: event.status === 'live' ? 'Đang trực tiếp' : 'Sự kiện sắp diễn ra',
            poster_url: event.thumbnailUrl || event.thumbnailBase64 || '/poster.jpg',
          }))
        : [];
      const movies = moviesResult.status === 'fulfilled' ? getNguoncItems(moviesResult.value).slice(0, 6) : [];
      setSlides([...pinnedEvents, ...movies]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const DURATION = 8000;
    const INTERVAL = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += INTERVAL;
      setProgress(elapsed / DURATION);
      if (elapsed >= DURATION) {
        setCurrentIndex(index => (index + 1) % slides.length);
        elapsed = 0;
        setProgress(0);
      }
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [slides, currentIndex]);

  if (loading) return <div className="h-[60vh] w-full animate-pulse bg-[#0A0A0A] md:h-[80vh]" />;
  if (!slides.length) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const description = String(currentSlide.description || 'Khám phá nội dung đang được nhiều khán giả quan tâm trên NhanChillTV.').replace(/<[^>]+>/g, ' ');
  const watchUrl = currentSlide.isEvent
    ? `/tv/?event=${encodeURIComponent(currentSlide.id)}${currentSlide.sourceChannelId ? `&channel=${encodeURIComponent(currentSlide.sourceChannelId)}` : ''}`
    : `/movie-detail/?slug=${encodeURIComponent(currentSlide.slug)}`;

  return (
    <motion.section 
      onPanEnd={(e, info) => {
        if (info.offset.x < -80) {
          setCurrentIndex((prev) => (prev + 1) % slides.length);
          setProgress(0);
        } else if (info.offset.x > 80) {
          setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
          setProgress(0);
        }
      }}
      className="group relative h-[60vh] w-full select-none overflow-hidden bg-black md:h-[80vh]"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background image with Ken Burns effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id || currentSlide.slug || currentIndex}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.6, ease: 'easeInOut' }, scale: { duration: 8, ease: 'linear' } }}
          className="absolute inset-0"
          style={{ willChange: 'transform, opacity' }}
        >
          <img src={getOPhimImageUrl(currentSlide.poster_url || currentSlide.thumb_url)} alt={currentSlide.name} className="h-full w-full object-cover opacity-65 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Content with staggered animation */}
      <div className="absolute inset-0 z-20 flex w-full flex-col justify-end px-4 pb-16 md:w-2/3 md:px-12 md:pb-28 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentSlide.id || currentSlide.slug || currentIndex}`}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.span variants={fadeSlideUp} className="mb-3 inline-block rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-bold tracking-wide text-white md:text-xs">
              {currentSlide.isEvent ? (currentSlide.status === 'live' ? 'SỰ KIỆN TRỰC TIẾP' : 'SỰ KIỆN ĐÃ GHIM') : 'PHIM PHỔ BIẾN'}
            </motion.span>
            <motion.h1 variants={fadeSlideUp} className="line-clamp-2 text-3xl font-black leading-tight text-white md:text-6xl">{currentSlide.name}</motion.h1>
            <motion.h2 variants={fadeIn} className="mt-2 text-sm font-bold text-white/60 md:text-xl">{currentSlide.original_name}</motion.h2>
            <motion.p variants={fadeIn} className="mb-6 mt-3 line-clamp-3 max-w-3xl text-xs text-white/80 md:text-base">{description}</motion.p>
            <motion.div variants={fadeSlideUp} className="flex items-center gap-3 pointer-events-auto">
              <a href={watchUrl} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-105 hover:bg-red-700"><Play fill="currentColor" size={19} /> {currentSlide.isEvent ? 'Xem sự kiện' : 'Xem ngay'}</a>
              {currentSlide.isEvent
                ? <a href="/events/" className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/30"><Info size={19} /> Sự kiện</a>
                : <button onClick={() => setModalSlug(currentSlide.slug)} className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/30"><Info size={19} /> Chi tiết</button>}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators with progress bar */}
      <div className="absolute bottom-7 right-5 z-20 flex items-center gap-2 md:right-12 pointer-events-auto">
        {slides.map((slide, index) => (
          <button
            key={slide.id || slide.slug || index}
            onClick={() => { setCurrentIndex(index); setProgress(0); }}
            className="relative h-1.5 overflow-hidden rounded-full bg-white/20 transition-all duration-300"
            style={{ width: index === currentIndex ? 32 : 16 }}
            title={`${slide.isEvent ? 'Sự kiện' : 'Phim'} ${index + 1}`}
          >
            {index === currentIndex && (
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[#ED2C25]"
                style={{ width: `${progress * 100}%`, transition: 'width 50ms linear' }}
              />
            )}
          </button>
        ))}
      </div>

      {modalSlug && <MovieModal slug={modalSlug} onClose={() => setModalSlug(null)} />}
    </motion.section>
  );
}
