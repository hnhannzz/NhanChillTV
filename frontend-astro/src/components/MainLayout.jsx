import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import WorldCupTicker from './WorldCupTicker';
import { useUIStore } from '../store/uiStore';
import classNames from 'classnames';
import Footer from './Footer';

export default function MainLayout({ children }) {
  const { isSidebarOpen, toggleSidebar } = useUIStore();
  const [hasTicker, setHasTicker] = React.useState(false);

  React.useEffect(() => {
    const checkTicker = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      setHasTicker(path.includes('/worldcup') || (path.includes('/tv') && search.includes('matchId')));
    };
    checkTicker();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="relative flex w-full flex-1 flex-col md:transition-[margin] md:duration-300 md:ease-in-out">
        <Header toggleSidebar={toggleSidebar} />
        <WorldCupTicker />
        
        <main id="main-scroll-container" className={classNames("mobile-scroll flex-1 overflow-y-auto overflow-x-hidden", {
          "pt-[108px] md:pt-[118px]": hasTicker,
          "pt-[70px] md:pt-[80px]": !hasTicker
        })}>
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
