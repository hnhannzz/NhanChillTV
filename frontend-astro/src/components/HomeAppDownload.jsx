import React, { useEffect, useState } from 'react';
import { Apple, Download, Monitor, Smartphone, X } from 'lucide-react';

const platforms = [
  {
    id: 'android-tv',
    name: 'Android TV',
    subtitle: 'TV Box, Google TV, Android TV',
    Icon: Monitor,
  },
  {
    id: 'android',
    name: 'Android',
    subtitle: 'Điện thoại và máy tính bảng Android',
    Icon: Smartphone,
  },
  {
    id: 'ios',
    name: 'iOS',
    subtitle: 'iPhone và iPad',
    Icon: Apple,
  },
];

export default function HomeAppDownload() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <section className="rounded-lg border border-white/10 bg-[#101010] px-4 py-4 shadow-xl shadow-black/20 sm:px-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ED2C25]">NhanChillTV App</p>
          <h2 className="mt-1 text-xl font-black text-white md:text-2xl">Tải app NhanChillTV</h2>
          <p className="mt-1 text-sm text-white/55">Android TV, Android và iOS sẽ được mở tải sau khi bản app hoàn tất.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#ED2C25] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
        >
          <Download size={18} />
          Tải app
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Tải app NhanChillTV">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Đóng" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-lg border border-white/10 bg-[#111] p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ED2C25]">Download</p>
                <h3 className="mt-1 text-2xl font-black text-white">Chọn phiên bản app</h3>
                <p className="mt-1 text-sm text-white/55">Các bản cài đặt sẽ được mở khi app sẵn sàng.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {platforms.map(({ id, name, subtitle, Icon }) => (
                <div key={id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#ED2C25]/15 text-[#ED2C25]">
                    <Icon size={22} />
                  </div>
                  <h4 className="mt-4 text-lg font-black text-white">{name}</h4>
                  <p className="mt-1 min-h-10 text-sm text-white/50">{subtitle}</p>
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full cursor-not-allowed rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/45"
                  >
                    Sắp ra mắt
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
