import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const platforms = [
  {
    id: 'android-tv',
    name: 'Android TV',
    subtitle: 'TV Box, Google TV, Android TV',
    icon: 'android-tv',
  },
  {
    id: 'android',
    name: 'Android',
    subtitle: 'Điện thoại và máy tính bảng Android',
    icon: 'android',
  },
  {
    id: 'ios',
    name: 'iOS',
    subtitle: 'iPhone và iPad',
    icon: 'ios',
  },
];

function PlatformIcon({ type }) {
  if (type === 'android-tv') {
    return (
      <span className="relative flex h-12 w-14 items-center justify-center rounded-md border-2 border-[#ED2C25] text-[#ED2C25]">
        <span className="absolute -bottom-1.5 h-1 w-6 rounded-full bg-[#ED2C25]" />
        <i className="fa-brands fa-android text-xl" aria-hidden="true" />
      </span>
    );
  }

  if (type === 'ios') {
    return <i className="bi bi-apple text-3xl" aria-hidden="true" />;
  }

  return <i className="fa-brands fa-android text-3xl" aria-hidden="true" />;
}

export default function AppDownloadButton() {
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#ED2C25] px-3 text-sm font-bold text-white transition-colors hover:bg-red-700 sm:px-4"
        title="Tải app NhanChillTV"
      >
        <Download size={17} />
        <span className="hidden lg:inline">Tải app</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Tải app NhanChillTV">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Đóng" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-lg border border-white/10 bg-[#111] p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ED2C25]">NhanChillTV App</p>
                <h3 className="mt-1 text-2xl font-black text-white">Chọn phiên bản app</h3>
                <p className="mt-1 text-sm text-white/55">Android TV, Android và iOS sẽ được mở tải khi app sẵn sàng.</p>
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
              {platforms.map(({ id, name, subtitle, icon }) => (
                <div key={id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#ED2C25]/15 text-[#ED2C25]">
                    <PlatformIcon type={icon} />
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
    </>
  );
}
