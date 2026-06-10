import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, Play } from 'lucide-react';
import MovieModal from './MovieModal';
import { fetchNguoncJson, getNguoncItems } from '../lib/nguoncApi';

export default function HeroBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalSlug, setModalSlug] = useState(null);

  useEffect(() => {
    fetchNguoncJson('/popular')
      .catch(() => fetchNguoncJson('/films/phim-moi-cap-nhat'))
      .then(data => setSlides(getNguoncItems(data).slice(0, 6)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => setCurrentIndex(index => (index + 1) % slides.length), 8000);
    return () => clearInterval(timer);
  }, [slides]);

  if (loading) return <div className="h-[60vh] w-full animate-pulse bg-[#0A0A0A] md:h-[80vh]" />;
  if (!slides.length) return null;

  const currentSlide = slides[currentIndex];
  const description = String(currentSlide.description || 'Khám phá bộ phim đang được nhiều khán giả quan tâm trên NhanChillTV.').replace(/<[^>]+>/g, ' ');

  return (
    <motion.section className="group relative h-[60vh] w-full select-none overflow-hidden bg-black md:h-[80vh]" onPanEnd={(event, info) => {
      if (info.offset.x < -50) setCurrentIndex(index => (index + 1) % slides.length);
      if (info.offset.x > 50) setCurrentIndex(index => (index - 1 + slides.length) % slides.length);
    }}>
      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0">
          <img src={currentSlide.poster_url || currentSlide.thumb_url || '/poster.jpg'} alt={currentSlide.name} className="h-full w-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-20 flex w-full flex-col justify-end px-4 pb-16 md:w-2/3 md:px-12 md:pb-28">
        <motion.div key={`content-${currentIndex}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <span className="mb-3 inline-block rounded bg-[#ED2C25] px-2 py-1 text-[10px] font-bold tracking-wide text-white md:text-xs">PHIM PHỔ BIẾN</span>
          <h1 className="line-clamp-2 text-3xl font-black leading-tight text-white md:text-6xl">{currentSlide.name}</h1>
          <h2 className="mt-2 text-sm font-bold text-white/60 md:text-xl">{currentSlide.original_name}</h2>
          <p className="mb-6 mt-3 line-clamp-3 max-w-3xl text-xs text-white/80 md:text-base">{description}</p>
          <div className="flex items-center gap-3">
            <a href={`/movie-detail/?slug=${encodeURIComponent(currentSlide.slug)}`} className="flex items-center gap-2 rounded-md bg-[#ED2C25] px-5 py-3 text-sm font-bold text-white hover:bg-red-700"><Play fill="currentColor" size={19} /> Xem ngay</a>
            <button onClick={() => setModalSlug(currentSlide.slug)} className="flex items-center gap-2 rounded-md bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-md hover:bg-white/30"><Info size={19} /> Chi tiết</button>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-7 right-5 z-20 flex gap-2 md:right-12">{slides.map((slide, index) => <button key={slide.slug || index} onClick={() => setCurrentIndex(index)} className={`h-1.5 rounded-full ${index === currentIndex ? 'w-8 bg-[#ED2C25]' : 'w-4 bg-white/35'}`} title={`Phim ${index + 1}`} />)}</div>
      {modalSlug && <MovieModal slug={modalSlug} onClose={() => setModalSlug(null)} />}
    </motion.section>
  );
}
