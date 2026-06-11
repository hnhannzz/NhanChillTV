import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUIStore } from '../store/uiStore';
import classNames from 'classnames';
import Footer from './Footer';

export default function MainLayout({ children, lockHeader = false }) {
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="relative flex w-full flex-1 flex-col md:transition-[margin] md:duration-300 md:ease-in-out">
        <Header toggleSidebar={toggleSidebar} autoHide={!lockHeader} />
        
        <main id="main-scroll-container" className="mobile-scroll flex-1 overflow-y-auto overflow-x-hidden pt-[70px] md:pt-[80px]">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
