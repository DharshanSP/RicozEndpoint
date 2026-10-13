'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function EnrollmentTokensLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']}>{children}</ProtectedRoute>
  );
}
