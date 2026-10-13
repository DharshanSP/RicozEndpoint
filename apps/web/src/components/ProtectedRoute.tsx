'use client';

import { type FC, type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '../context/AuthContext';
import { LoadingPage } from './LoadingPage';
import { Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Preserve the attempted destination so LoginPage can send the user back after auth.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return <LoadingPage message="Verifying security session..." subtext="Validating authentication tokens..." />;
  }

  if (!isAuthenticated) {
    // Navigation to /login is in flight; render nothing to avoid a logged-out flash.
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 rounded-xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 border border-red-200">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500">
          Your role (<span className="text-slate-800 font-semibold">{user?.role}</span>) does not have permission to view this section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
