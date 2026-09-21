import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Monitor, AlertTriangle, CheckCircle2, Lock, UserCheck, Key } from 'lucide-react';

export function DashboardPage() {
  const { user, hasRole } = useAuth();

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Phase 3 Active — DB Authentication & RBAC Engine
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name || 'Administrator'}
          </h2>
          <p className="text-sm text-slate-400">
            Authenticated via PostgreSQL database with role: <strong className="text-blue-300">{user?.role}</strong>
          </p>
        </div>
      </div>

      {/* Permission Capabilities Matrix */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Your Active RBAC Permissions Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Device Monitoring & Status</span>
              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN', 'OPERATOR', 'VIEWER']) ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <p className="text-xs text-slate-400">View registered devices, online heartbeats, and hardware stats.</p>
            <span className="inline-block text-[11px] font-medium text-emerald-400">Granted to all authenticated users</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Execute Remote Commands</span>
              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN', 'OPERATOR']) ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <p className="text-xs text-slate-400">Issue device restarts, locks, and inventory sync actions.</p>
            <span className={`inline-block text-[11px] font-medium ${hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN', 'OPERATOR']) ? 'text-emerald-400' : 'text-amber-500'}`}>
              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN', 'OPERATOR']) ? 'Active for your role' : 'Requires OPERATOR or higher'}
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">User & RBAC Administration</span>
              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN']) ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <p className="text-xs text-slate-400">Create new admin accounts, assign roles, and modify permissions.</p>
            <span className={`inline-block text-[11px] font-medium ${hasRole(['SUPER_ADMIN', 'ORG_ADMIN']) ? 'text-emerald-400' : 'text-slate-500'}`}>
              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN']) ? 'Active for your role' : 'Requires ORG_ADMIN or SUPER_ADMIN'}
            </span>
          </div>
        </div>
      </div>

      {/* Demo Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Devices</span>
            <Monitor className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">5</p>
          <span className="text-[11px] text-slate-500">Seeded in Demo Database</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Current User Role</span>
            <UserCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{user?.role}</p>
          <span className="text-[11px] text-slate-500">{user?.organizationName || 'Ricoz Demo Org'}</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Auth Token Status</span>
            <Key className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">VALID</p>
          <span className="text-[11px] text-slate-500">Fastify JWT Verified</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Upcoming Phase</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">Phase 4</p>
          <span className="text-[11px] text-slate-500">Device Agent Enrollment</span>
        </div>
      </div>
    </div>
  );
}
