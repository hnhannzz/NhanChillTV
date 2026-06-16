import React, { Suspense, lazy } from 'react';

const TvPageContainer = lazy(() => import('./TvPageContainer.jsx'));

export default function LazyTvPageContainer() {
  return (
    <Suspense fallback={<div className="aspect-video w-full animate-pulse rounded-lg bg-white/5" />}>
      <TvPageContainer />
    </Suspense>
  );
}
