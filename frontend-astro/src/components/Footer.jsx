import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-[#0A0A0A] px-4 py-8 text-xs text-white/45 md:px-8">
      <div className="mx-auto mb-6 flex justify-center">
        <div className="flex items-center gap-2.5 bg-[#ED2C25] text-white px-5 py-2.5 rounded-full font-bold shadow-[0_0_20px_rgba(237,44,37,0.3)] text-sm transition-transform hover:scale-105">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Flag_of_Vietnam.svg/120px-Flag_of_Vietnam.svg.png" alt="Cờ Việt Nam" className="w-7 h-4.5 object-cover rounded-sm shadow-sm" />
          <span>Hoàng Sa & Trường Sa là của Việt Nam!</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>Copyright NhanChillTV 2026. Thuộc hệ thống NN56 Network.</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span>Phim sử dụng <a href="https://ophim1.com" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">OPhim</a></span>
          <span>EPG: <a href="https://vnepg.site" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">vnepg.site</a></span>
          <span>IPTV: vuminhthanh12</span>
          <span>World Cup API: <a href="https://github.com/rezarahiminia" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">rezarahiminia</a></span>
          <span>Icon packs: smalllikeart &amp; flaticon.com</span>
        </div>
      </div>
    </footer>
  );
}
