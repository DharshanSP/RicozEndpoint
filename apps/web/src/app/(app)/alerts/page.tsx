'use client';

import { Suspense } from 'react';
import { AlertsPage } from '@/views/AlertsPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlertsPage />
    </Suspense>
  );
}
