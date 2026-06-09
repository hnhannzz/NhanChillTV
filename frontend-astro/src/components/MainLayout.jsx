import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUIStore } from '../store/uiStore';
import classNames from 'classnames';

export default function MainLayout({ children }) {
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div 
        className="flex-1 flex flex-col transition-all duration-300 ease-in-out relative w-full"
      >
        <Header toggleSidebar={toggleSidebar} />
        
        <main id="main-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden pt-[70px] md:pt-[80px]">
          {children}
        </main>
      </div>
    </div>
  );
}
