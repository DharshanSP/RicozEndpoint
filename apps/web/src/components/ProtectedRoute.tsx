import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 animate-pulse">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-medium text-slate-400">Verifying security session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Access Restricted</h3>
        <p className="text-sm text-slate-400">
          Your role (<span className="text-slate-200 font-semibold">{user?.role}</span>) does not have permission to view this section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
