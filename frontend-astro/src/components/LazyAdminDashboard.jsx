import React, { Suspense, lazy } from 'react';

const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'));

export default function LazyAdminDashboard() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#090909] text-sm font-semibold text-white/55">Đang tải admin...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
