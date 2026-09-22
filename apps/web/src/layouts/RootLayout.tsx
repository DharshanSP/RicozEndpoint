import { useState, type ElementType } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  Laptop,
  Layers,
  ShieldCheck,
  Package,
  Wrench,
  CheckSquare,
  Bell,
  BarChart3,
  History,
  Users,
  Settings,
  LogOut,
  Building2,
  UserCheck,
  Search,
  Menu,
  X,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';

interface NavItemConfig {
  name: string;
  to: string;
  icon: ElementType;
  roles?: ('SUPER_ADMIN' | 'ORG_ADMIN' | 'IT_ADMIN' | 'OPERATOR' | 'VIEWER')[];
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';
}

interface NavSection {
  title: string;
  items: NavItemConfig[];
}

export function RootLayout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'purple';
      case 'ORG_ADMIN':
        return 'info';
      case 'IT_ADMIN':
        return 'info';
      case 'OPERATOR':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const navigationSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'DEVICES',
      items: [
        { name: 'Devices', to: '/devices', icon: Laptop },
        { name: 'Device Groups', to: '/devices/groups', icon: Layers },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Policies', to: '/policies', icon: ShieldCheck },
        { name: 'Software', to: '/software', icon: Package },
        { name: 'Patch Management', to: '/patches', icon: Wrench },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        { name: 'Compliance', to: '/compliance', icon: CheckSquare },
        { name: 'Alerts', to: '/alerts', icon: Bell },
      ],
    },
    {
      title: 'INSIGHTS',
      items: [
        { name: 'Reports', to: '/reports', icon: BarChart3 },
        { name: 'Audit Logs', to: '/audit-logs', icon: History },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        {
          name: 'Users & Roles',
          to: '/users',
          icon: Users,
          roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN'],
        },
        { name: 'Settings', to: '/settings', icon: Settings },
      ],
    },
  ];

  // Helper to compute dynamic breadcrumbs from location
  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return { section: 'Overview', page: 'Dashboard' };
    if (path.startsWith('/devices/groups')) return { section: 'Devices', page: 'Device Groups' };
    if (path.startsWith('/devices')) return { section: 'Devices', page: 'Fleet Devices' };
    if (path.startsWith('/policies')) return { section: 'Management', page: 'Policies' };
    if (path.startsWith('/software')) return { section: 'Management', page: 'Software Catalog' };
    if (path.startsWith('/patches')) return { section: 'Management', page: 'Patch Management' };
    if (path.startsWith('/compliance')) return { section: 'Security', page: 'Compliance Rules' };
    if (path.startsWith('/alerts')) return { section: 'Security', page: 'Security Alerts' };
    if (path.startsWith('/reports')) return { section: 'Insights', page: 'Reports & Analytics' };
    if (path.startsWith('/audit-logs')) return { section: 'Insights', page: 'Audit Logs' };
    if (path.startsWith('/users')) return { section: 'Administration', page: 'Users & Roles' };
    if (path.startsWith('/settings')) return { section: 'Administration', page: 'Settings' };
    return { section: 'RicozEndpoint', page: 'Overview' };
  };

  const breadcrumbs = getBreadcrumbTitle();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Brand Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                  RicozEndpoint
                </h1>
                <span className="text-[11px] text-slate-400">Enterprise Admin Console</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Org Selector Box */}
          <div className="px-3 pt-3 pb-1">
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-slate-300 font-medium truncate">
                  {user?.organizationName || 'Ricoz Primary Organization'}
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Nav Items */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            {navigationSections.map((section) => {
              // Filter items based on RBAC permissions
              const visibleItems = section.items.filter((item) => {
                if (!item.roles) return true;
                return hasRole(item.roles);
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.name}
                          to={item.to}
                          end={item.to === '/'}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              isActive
                                ? 'bg-slate-900 text-blue-400 font-semibold border border-slate-800 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                            }`
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* User Profile & Footer Section */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 space-y-2.5">
            {user && (
              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                  <span className="text-[10px] text-slate-400">Role</span>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] px-1.5 py-0 font-medium">
                    <UserCheck className="w-3 h-3 mr-1" />
                    {user.role}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-400">{breadcrumbs.section}</span>
              <span className="text-slate-600">/</span>
              <span className="font-semibold text-slate-200">{breadcrumbs.page}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Trigger Mockup */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-400 w-64 justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 truncate">Search endpoints, policies...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-950 border border-slate-800 rounded text-slate-400">
                Ctrl+K
              </kbd>
            </div>

            {/* Environment Telemetry Status Indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[11px] text-slate-300 font-medium">Preview Mode</span>
            </div>

            {/* Org Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300 font-medium text-xs max-w-[130px] truncate">
                {user?.organizationName || 'Default Org'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-6 lg:p-8 bg-slate-950 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
