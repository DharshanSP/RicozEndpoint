'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function EnrollmentTokensLayout({ children }: { children: React.ReactNode }) {
  // Operators and viewers reach this page to request a token and view their own
  // requests; the page itself hides every privileged action from them.
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
