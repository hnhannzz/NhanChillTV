import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Play, Trophy } from 'lucide-react';
import { fetchOPhimJson, getOPhimItems, getOPhimImageUrl } from '../lib/OPhimApi';

const MovieModal = lazy(() => import('./MovieModal.jsx'));

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

const WORLD_CUP_SLIDE = {
  id: 'worldcup-2026-hero',
  isWorldCup: true,
  name: 'FIFA World Cup 2026™',
  original_name: 'FIFA World Cup 2026',
  description: 'Theo dõi lịch thi đấu theo giờ Việt Nam GMT+7, tỉ số realtime, bảng xếp hạng và chọn luồng bình luận World Cup ngay trên NhanChillTV.',
  poster_url: 'https://i.ibb.co/wr7DkswW/ezgif-8545a79bc51d4b23.webp',
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
      fetchOPhimJson('/popular').catch(() => fetchOPhimJson('/danh-sach/phim-moi-cap-nhat')),
    ]).then(([eventsResult, moviesResult]) => {
      const pinnedEvents = eventsResult.status === 'fulfilled' && eventsResult.value.success
        ? eventsResult.value.data
          .filter(event => event.isPinned && event.status !== 'ended')
          .map(event => ({
            ...event,
            isEvent: true,
            name: event.title,
            original_name: event.status === 'live' ? 'Live event' : 'Upcoming event',
            poster_url: event.thumbnailUrl || event.thumbnailBase64 || '/poster.jpg',
          }))
        : [];

      const rawMovies = moviesResult.status === 'fulfilled' ? getOPhimItems(moviesResult.value).slice(0, 6) : [];
      const movies = rawMovies.map(movie => ({
        ...movie,
        original_name: movie.origin_name || movie.original_name || '',
        description: movie.content || movie.description || '',
      }));

      setSlides([WORLD_CUP_SLIDE, ...pinnedEvents, ...movies]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const duration = 8000;
    const interval = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      setProgress(elapsed / duration);
      if (elapsed >= duration) {
        setCurrentIndex(index => (index + 1) % slides.length);
        elapsed = 0;
        setProgress(0);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [slides, currentIndex]);

  if (loading) return <div className="h-[60vh] w-full animate-pulse bg-[#0A0A0A] md:h-[80vh]" />;
  if (!slides.length) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const description = String(currentSlide.description || 'Khám phá nội dung đang được nhiều khán giả quan tâm trên NhanChillTV.').replace(/<[^>]+>/g, ' ');
  const originalTitle = String(currentSlide.origin_name || currentSlide.original_name || '').trim();
  const shouldShowOriginalTitle = originalTitle && originalTitle.toLowerCase() !== String(currentSlide.name || '').trim().toLowerCase();
  const titleLength = String(currentSlide.name || '').length;
  const titleClass = titleLength > 58
    ? 'text-[1.65rem] md:text-5xl'
    : titleLength > 36
    ? 'text-[1.9rem] md:text-[3.35rem]'
    : 'text-3xl md:text-6xl';
  const movieDetailSlug = !currentSlide.isWorldCup && !currentSlide.isEvent ? currentSlide.slug : '';
  const watchUrl = currentSlide.isWorldCup
    ? '/worldcup/'
    : currentSlide.isEvent
    ? `/tv/?event=${encodeURIComponent(currentSlide.id)}${currentSlide.sourceChannelId ? `&channel=${encodeURIComponent(currentSlide.sourceChannelId)}` : ''}`
    : `/movie-detail/?slug=${encodeURIComponent(movieDetailSlug)}`;
  const imageUrl = currentSlide.isWorldCup || currentSlide.isEvent
    ? (currentSlide.poster_url || '/poster.jpg')
    : getOPhimImageUrl(currentSlide.poster_url || currentSlide.thumb_url);
  const openMovieDetails = event => {
    event.preventDefault();
    event.stopPropagation();
    const slug = event.currentTarget.dataset.slug;
    if (slug) setModalSlug(slug);
  };

  return (
    <motion.section
      onPanEnd={(event, info) => {
        if (info.offset.x < -80) {
          setCurrentIndex(prev => (prev + 1) % slides.length);
          setProgress(0);
        } else if (info.offset.x > 80) {
          setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
          setProgress(0);
        }
      }}
      className="group relative h-[60vh] w-full select-none overflow-hidden bg-black md:h-[80vh]"
      style={{ touchAction: 'pan-y' }}
    >
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
          <img src={imageUrl} alt={currentSlide.name} className="pointer-events-none h-full w-full object-cover opacity-65" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-20 flex w-full flex-col justify-end px-4 pb-16 md:w-2/3 md:px-12 md:pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentSlide.id || currentSlide.slug || currentIndex}`}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.span variants={fadeSlideUp} className="mb-3 inline-block rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-bold tracking-wide text-white md:text-xs">
              {currentSlide.isWorldCup ? 'FIFA WORLD CUP 2026' : currentSlide.isEvent ? (currentSlide.status === 'live' ? 'SỰ KIỆN TRỰC TIẾP' : 'SỰ KIỆN ĐÃ GHIM') : 'PHIM PHỔ BIẾN'}
            </motion.span>
            <motion.h1 variants={fadeSlideUp} className={`max-w-4xl break-words font-black leading-tight text-white ${titleClass}`}>{currentSlide.name}</motion.h1>
            {shouldShowOriginalTitle && (
              <motion.h2 variants={fadeIn} className="mt-2 text-xs font-bold text-white/70 md:text-sm">{originalTitle}</motion.h2>
            )}
            <motion.p variants={fadeIn} className="mb-6 mt-3 line-clamp-3 max-w-3xl text-xs text-white/80 md:text-base">{description}</motion.p>
            <motion.div variants={fadeSlideUp} className="pointer-events-auto flex items-center gap-3">
              <a href={watchUrl} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-105 hover:bg-red-700">
                {currentSlide.isWorldCup ? <Trophy size={19} /> : <Play fill="currentColor" size={19} />}
                {currentSlide.isWorldCup ? 'Mở World Cup' : currentSlide.isEvent ? 'Xem sự kiện' : 'Xem ngay'}
              </a>
              {currentSlide.isWorldCup ? (
                <a href="/worldcup/" className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/30"><Info size={19} /> Lịch & bảng đấu</a>
              ) : currentSlide.isEvent ? (
                <a href="/events/" className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/30"><Info size={19} /> Sự kiện</a>
              ) : (
                <button type="button" data-slug={movieDetailSlug} onClick={openMovieDetails} className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/30"><Info size={19} /> Xem thêm</button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-auto absolute bottom-7 right-5 z-20 flex items-center gap-2 md:right-12">
        {slides.map((slide, index) => (
          <button
            key={slide.id || slide.slug || index}
            onClick={() => { setCurrentIndex(index); setProgress(0); }}
            className="relative h-1.5 overflow-hidden rounded-full bg-white/20 transition-all duration-300"
            style={{ width: index === currentIndex ? 32 : 16 }}
            title={`${slide.isEvent ? 'Sự kiện' : slide.isWorldCup ? 'World Cup' : 'Phim'} ${index + 1}`}
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

      {modalSlug && (
        <Suspense fallback={null}>
          <MovieModal slug={modalSlug} onClose={() => setModalSlug(null)} />
        </Suspense>
      )}
    </motion.section>
  );
}
