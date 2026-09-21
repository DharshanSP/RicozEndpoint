import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LayoutDashboard, Monitor, Users, LogOut, Building2, UserCheck } from 'lucide-react';

export function RootLayout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'ORG_ADMIN':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'IT_ADMIN':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'OPERATOR':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between p-5">
        <div className="space-y-6">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white">RicozEndpoint</h1>
              <p className="text-xs text-slate-400">Enterprise Admin</p>
            </div>
          </div>

          {/* Org Info Box */}
          {user && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate">{user.organizationName || 'Default Org'}</span>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className="space-y-1">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-200 bg-blue-600/10 border border-blue-500/20 text-blue-400"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <div className="pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3">
              Management
            </div>

            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition"
            >
              <Monitor className="w-4 h-4" />
              <span>Devices</span>
            </Link>

            {hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']) && (
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition"
              >
                <Users className="w-4 h-4" />
                <span>Users & RBAC</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Profile & Logout */}
        {user && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeStyle(
                  user.role
                )}`}
              >
                <UserCheck className="w-3 h-3" />
                {user.role}
              </span>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-8">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>RicozEndpoint Hub</span>
            <span>/</span>
            <span className="text-slate-200 font-medium">Dashboard Overview</span>
          </div>

          {user && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Signed in as <strong className="text-slate-200">{user.name}</strong></span>
            </div>
          )}
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
