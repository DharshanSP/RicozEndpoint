'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RootLayout } from '@/layouts/RootLayout';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RootLayout>{children}</RootLayout>
    </ProtectedRoute>
  );
}
