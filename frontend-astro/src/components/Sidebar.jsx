import React from 'react';
import { Home, Tv, Film, Medal, Settings, LogOut, X } from 'lucide-react';
import classNames from 'classnames';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const menuItems = [
    { icon: Home, label: 'Trang chủ', href: '/' },
    { icon: Tv, label: 'Truyền hình', href: '/tv/' },
    { icon: Medal, label: 'Sự kiện', href: '/events/' },
    { icon: Film, label: 'Phim', href: '/movies/' }
  ];

  return (
    <>
      {/* Mobile & Desktop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55]"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={classNames(
          'fixed top-0 left-0 bottom-0 w-[240px] bg-[#121212] z-[60] transform transition-transform duration-300 ease-in-out border-r border-white/5 flex flex-col',
          {
            'translate-x-0': isOpen,
            '-translate-x-full': !isOpen,
          }
        )}
      >
        <div className="h-[64px] flex items-center justify-between px-4 border-b border-white/5">
          <img src="/logo/logo.png?v=1.65" alt="NhanChillTV" className="h-[36px] object-contain" onError={(e) => {
            e.target.src = 'https://via.placeholder.com/150x50?text=NhanChillTV';
          }} />
          <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-full">
            <X size={20} className="text-white/70" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                key={index}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-white/80 hover:text-white font-medium"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <button 
            onClick={() => {
              localStorage.removeItem('userToken');
              localStorage.removeItem('userName');
              window.location.reload();
            }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[#ED2C25]/20 transition-colors text-[#ED2C25] font-medium"
          >
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
