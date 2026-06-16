import React, { useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUIStore } from '../store/uiStore';
import classNames from 'classnames';
import Footer from './Footer';

export default function MainLayout({ children }) {
  const { isSidebarOpen, toggleSidebar } = useUIStore();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 650);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      {booting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <span className="absolute inset-0 rounded-full border-2 border-white/10" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#ED2C25]" />
            </div>
            <div className="text-sm font-bold tracking-wide text-white/70">Đang tải NhanChillTV</div>
          </div>
        </div>
      )}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="relative flex w-full flex-1 flex-col md:transition-[margin] md:duration-300 md:ease-in-out">
        <Header toggleSidebar={toggleSidebar} />
        
        <main id="main-scroll-container" className="mobile-scroll flex-1 overflow-y-auto overflow-x-hidden pt-[70px] md:pt-[80px]">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
