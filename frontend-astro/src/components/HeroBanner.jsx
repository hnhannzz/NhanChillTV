import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Info, Play } from 'lucide-react';
import MovieModal from './MovieModal';
import { fetchNguoncJson, getNguoncItems } from '../lib/nguoncApi';

const SLIDE_DURATION_MS = 8000;

const contentVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.07 } },
};

const contentItemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function HeroBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalSlug, setModalSlug] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/admin/events').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetchNguoncJson('/popular').catch(() => fetchNguoncJson('/films/phim-moi-cap-nhat')),
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
    const timer = setTimeout(() => setCurrentIndex(index => (index + 1) % slides.length), SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [currentIndex, slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const nextSlide = slides[(currentIndex + 1) % slides.length];
    const nextImage = nextSlide?.poster_url || nextSlide?.thumb_url;
    if (nextImage) new Image().src = nextImage;
  }, [currentIndex, slides]);

  if (loading) return <div className="h-[60vh] w-full animate-pulse bg-[#0A0A0A] md:h-[80vh]" />;
  if (!slides.length) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const description = String(currentSlide.description || 'Khám phá nội dung đang được nhiều khán giả quan tâm trên NhanChillTV.').replace(/<[^>]+>/g, ' ');
  const watchUrl = currentSlide.isEvent
    ? `/tv/?event=${encodeURIComponent(currentSlide.id)}${currentSlide.sourceChannelId ? `&channel=${encodeURIComponent(currentSlide.sourceChannelId)}` : ''}`
    : `/movie-detail/?slug=${encodeURIComponent(currentSlide.slug)}`;
  const goToSlide = index => setCurrentIndex((index + slides.length) % slides.length);

  return (
    <motion.section style={{ touchAction: 'pan-y' }} className="group relative h-[60vh] w-full select-none overflow-hidden bg-black md:h-[80vh]" onPanEnd={(event, info) => {
      if (info.offset.x < -50) goToSlide(currentIndex + 1);
      if (info.offset.x > 50) goToSlide(currentIndex - 1);
    }}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={currentSlide.id || currentSlide.slug || currentIndex}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: reduceMotion ? 0.01 : 0.65, ease: 'easeInOut' }, scale: { duration: reduceMotion ? 0.01 : 8.2, ease: 'linear' } }}
          className="absolute inset-0"
        >
          <img src={currentSlide.poster_url || currentSlide.thumb_url || '/poster.jpg'} alt={currentSlide.name} className="h-full w-full object-cover opacity-65" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-20 flex w-full flex-col justify-end px-4 pb-16 md:w-2/3 md:px-12 md:pb-28">
        <motion.div
          key={`content-${currentSlide.id || currentSlide.slug || currentIndex}`}
          variants={reduceMotion ? undefined : contentVariants}
          initial={reduceMotion ? { opacity: 0 } : 'hidden'}
          animate={reduceMotion ? { opacity: 1 } : 'visible'}
          transition={reduceMotion ? { duration: 0.01 } : undefined}
        >
          <motion.span variants={reduceMotion ? undefined : contentItemVariants} className="mb-3 inline-block rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-bold tracking-wide text-white md:text-xs">{currentSlide.isEvent ? (currentSlide.status === 'live' ? 'SỰ KIỆN TRỰC TIẾP' : 'SỰ KIỆN ĐÃ GHIM') : 'PHIM PHỔ BIẾN'}</motion.span>
          <motion.h1 variants={reduceMotion ? undefined : contentItemVariants} className="line-clamp-2 text-3xl font-black leading-tight text-white md:text-6xl">{currentSlide.name}</motion.h1>
          <motion.h2 variants={reduceMotion ? undefined : contentItemVariants} className="mt-2 text-sm font-bold text-white/60 md:text-xl">{currentSlide.original_name}</motion.h2>
          <motion.p variants={reduceMotion ? undefined : contentItemVariants} className="mb-6 mt-3 line-clamp-3 max-w-3xl text-xs text-white/80 md:text-base">{description}</motion.p>
          <motion.div variants={reduceMotion ? undefined : contentItemVariants} className="flex items-center gap-3">
            <a href={watchUrl} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-5 py-3 text-sm font-bold text-white hover:bg-red-700"><Play fill="currentColor" size={19} /> {currentSlide.isEvent ? 'Xem sự kiện' : 'Xem ngay'}</a>
            {currentSlide.isEvent
              ? <a href="/events/" className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md hover:bg-white/30"><Info size={19} /> Sự kiện</a>
              : <button onClick={() => setModalSlug(currentSlide.slug)} className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md hover:bg-white/30"><Info size={19} /> Chi tiết</button>}
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-7 right-5 z-20 flex gap-2 md:right-12">
        {slides.map((slide, index) => (
          <button
            key={slide.id || slide.slug || index}
            type="button"
            onClick={() => goToSlide(index)}
            className={`relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-[width] duration-300 ${index === currentIndex ? 'w-8' : 'w-4 hover:bg-white/45'}`}
            aria-label={`${slide.isEvent ? 'Sự kiện' : 'Phim'} ${index + 1}`}
          >
            {index === currentIndex && (
              <motion.span
                key={`progress-${currentIndex}`}
                className="hero-progress absolute inset-y-0 left-0 rounded-full bg-[#ED2C25]"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: reduceMotion ? 0.01 : SLIDE_DURATION_MS / 1000, ease: 'linear' }}
              />
            )}
          </button>
        ))}
      </div>
      {modalSlug && <MovieModal slug={modalSlug} onClose={() => setModalSlug(null)} />}
    </motion.section>
  );
}
