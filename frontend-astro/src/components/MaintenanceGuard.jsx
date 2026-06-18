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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 rounded-full border border-white/10" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#ED2C25]" />
            <span className="absolute inset-4 rounded-full bg-[#ED2C25]/20" />
          </div>
          <div className="text-center">
            <div className="text-lg font-black">NhanChillTV</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/40">Đang tải hệ thống</div>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl">
          <svg className="mx-auto mb-6 h-20 w-20 text-[#ED2C25]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h1 className="mb-4 text-3xl font-black text-white">Hệ thống đang bảo trì</h1>
          <p className="mb-6 leading-relaxed text-white/70">
            NhanChillTV đang tạm dừng hoạt động để cập nhật hệ thống. Quá trình này thường diễn ra nhanh, vui lòng quay lại sau ít phút.
          </p>
          <button onClick={() => window.location.reload()} className="w-full rounded-xl bg-[#ED2C25] py-3 font-bold text-white transition-all hover:bg-red-700">
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return children;
}
