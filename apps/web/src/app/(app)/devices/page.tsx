'use client';

import { Suspense } from 'react';
import { DevicesPage } from '@/views/DevicesPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DevicesPage />
    </Suspense>
  );
}
