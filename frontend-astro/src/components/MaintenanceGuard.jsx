import React, { useEffect, useState } from 'react';

export default function MaintenanceGuard({ children }) {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/system/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.data) {
          setMaintenance(data.data.maintenanceMode);
        }
      })
      .catch(err => console.error('Failed to check system status:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-3">
      <img src="/logo/logo.png?v=1.65" alt="NhanChillTV" className="h-16 md:h-20 object-contain animate-pulse" />
      <div className="text-xs font-bold text-[#ED2C25] tracking-widest uppercase">Xem Truyền Hình & Bóng Đá</div>
      <div className="w-44 h-[3px] bg-white/10 rounded-full overflow-hidden mt-1">
        <div className="h-full bg-[#ED2C25] rounded-full animate-[loader-slide_2s_infinite_ease-in-out]" style={{transformOrigin:'left'}} />
      </div>
    </div>;
  }

  if (maintenance) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-6">
        <div className="max-w-md w-full bg-[#121212] p-8 rounded-2xl border border-white/10 shadow-2xl">
          <svg className="w-20 h-20 text-[#ED2C25] mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h1 className="text-3xl font-black text-white mb-4">Hệ Thống Đang Bảo Trì</h1>
          <p className="text-white/70 mb-6 leading-relaxed">
            NhanChillTV hiện đang tạm dừng hoạt động để cập nhật và nâng cấp hệ thống. Quá trình này sẽ diễn ra nhanh chóng. Xin lỗi bạn vì sự bất tiện này!
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-[#ED2C25] hover:bg-red-700 text-white rounded-xl font-bold transition-all">
            Tải Lại Trang
          </button>
        </div>
      </div>
    );
  }

  return children;
}
