import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-[#0A0A0A] px-4 py-8 text-xs text-white/45 md:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>Copyright NhanChillTV 2026. Thuộc hệ thống NN56 Network.</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span>Phim sử dụng <a href="https://phim.nguonc.com" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">NguonC</a></span>
          <span>EPG: <a href="https://vnepg.site" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">vnepg.site</a></span>
          <span>IPTV: vuminhthanh12</span>
          <span>Icon packs: smalllikeart &amp; flaticon.com</span>
        </div>
      </div>
    </footer>
  );
}
