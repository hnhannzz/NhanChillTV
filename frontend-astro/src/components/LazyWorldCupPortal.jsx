import React, { Suspense, lazy } from 'react';

const WorldCupPortal = lazy(() => import('./WorldCupPortal.jsx'));

export default function LazyWorldCupPortal() {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-28 animate-pulse rounded-lg bg-white/5" /><div className="grid gap-4 md:grid-cols-2"><div className="h-44 animate-pulse rounded-lg bg-white/5" /><div className="h-44 animate-pulse rounded-lg bg-white/5" /></div></div>}>
      <WorldCupPortal />
    </Suspense>
  );
}
