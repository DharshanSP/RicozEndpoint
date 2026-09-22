import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Server,
  Activity,
  Users,
  PlusCircle,
  CheckSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const { data: telemetryData, loading, error, refresh } = useDashboardData(timeRange);

  const handleRefresh = async () => {
    await refresh();
    setLastRefreshed(new Date());
  };

  // Error state for unexpected data service failure
  if (error && !telemetryData) {
    return (
      <div className="max-w-7xl mx-auto p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Telemetry Ingestion Error</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </Button>
      </div>
    );
  }

  // Initial loading state skeleton
  if (loading && !telemetryData) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-10 w-1/3 bg-slate-900 rounded-md border border-slate-800/80" />
        <div className="h-12 w-full bg-slate-900/60 rounded-lg border border-slate-800/80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/50 rounded-lg border border-slate-800/80" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-900/40 rounded-lg border border-slate-800/80" />
          <div className="h-64 bg-slate-900/40 rounded-lg border border-slate-800/80" />
        </div>
      </div>
    );
  }

  // If telemetryData is null and not loading, provide fallback empty object
  if (!telemetryData) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Operational Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">System Admin Dashboard</h1>
            <Badge variant="outline" className="text-[11px] font-mono border-slate-700 text-slate-300">
              {user?.organizationName || 'Ricoz Organization'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Centralized visibility into organization endpoints, operational fleet health, and security posture.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Telemetry Status Banner (Transparent Data Demarcation) */}
      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-200">Telemetry Data Mode: </span>
            <span className="text-slate-400">
              Visualizing endpoint structure & preview telemetry stream. Live agent daemon streaming pipeline is staged.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last sync: {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 5 Core Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Endpoints */}
        <Card className="border-slate-800/90 bg-slate-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Managed</span>
              <Laptop className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white tracking-tight">{telemetryData.totalDevices}</span>
              <span className="text-[11px] text-slate-400">Endpoints</span>
            </div>
            <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Enrolled Fleet</span>
              <span className="text-blue-400 font-medium">100% Configured</span>
            </div>
          </CardContent>
        </Card>

        {/* Online Devices */}
        <Card className="border-slate-800/90 bg-slate-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Online / Active</span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400 tracking-tight">
                {telemetryData.onlineDevices}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                {((telemetryData.onlineDevices / telemetryData.totalDevices) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Streaming Heartbeats</span>
              <span className="text-emerald-400 font-medium">Active</span>
            </div>
          </CardContent>
        </Card>

        {/* Offline Devices */}
        <Card className="border-slate-800/90 bg-slate-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Offline / Inactive</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 tracking-tight">
                {telemetryData.offlineDevices}
              </span>
              <span className="text-[11px] text-slate-400">
                +1 Pending
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Threshold: &gt; 5m</span>
              <span className="text-amber-400 font-medium">Review Needed</span>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Compliance */}
        <Card className="border-slate-800/90 bg-slate-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Compliance Rate</span>
              <CheckSquare className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white tracking-tight">{telemetryData.complianceScore}%</span>
              <span className="text-[11px] text-emerald-400 font-medium">Target &gt;90%</span>
            </div>
            <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Security Baseline</span>
              <span className="text-emerald-400 font-medium">Passing</span>
            </div>
          </CardContent>
        </Card>

        {/* Open Alerts */}
        <Card className="border-slate-800/90 bg-slate-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Alerts</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-400 tracking-tight">{telemetryData.openAlertsCount}</span>
              <span className="text-[11px] text-rose-400 font-medium">
                {telemetryData.criticalAlertsCount} Critical
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Triage Required</span>
              <span className="text-rose-400 font-medium">Actionable</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Operational Section: Health Distribution & Compliance Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Fleet Health & Status */}
        <Card className="border-slate-800/90 bg-slate-900/40">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">Endpoint Health Breakdown</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Real-time connectivity and heartbeat status
                </CardDescription>
              </div>
              <Link to="/devices">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 gap-1 p-0">
                  <span>View All Endpoints</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {/* Visual Health Proportion Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(telemetryData.onlineDevices / telemetryData.totalDevices) * 100}%` }}
                  className="bg-emerald-500"
                  title="Online"
                />
                <div
                  style={{ width: `${(telemetryData.offlineDevices / telemetryData.totalDevices) * 100}%` }}
                  className="bg-amber-500"
                  title="Offline"
                />
                <div
                  style={{ width: `${(telemetryData.pendingEnrollment / telemetryData.totalDevices) * 100}%` }}
                  className="bg-blue-500"
                  title="Pending Enrollment"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Online: {telemetryData.onlineDevices}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Offline: {telemetryData.offlineDevices}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Pending: {telemetryData.pendingEnrollment}
                </span>
              </div>
            </div>

            {/* Operating System Distribution */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <span className="text-xs font-semibold text-slate-300 block">Operating System Distribution</span>
              <div className="space-y-2">
                {telemetryData.osDistribution.map((os) => (
                  <div key={os.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{os.name}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {os.count} ({os.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${os.color}`} style={{ width: `${os.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Posture Matrix */}
        <Card className="border-slate-800/90 bg-slate-900/40">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">Security & Compliance Posture</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Adherence to organization baseline security policies
                </CardDescription>
              </div>
              <Link to="/compliance">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 gap-1 p-0">
                  <span>Manage Rules</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="space-y-2">
              {telemetryData.complianceControls.map((control) => {
                const passRate = ((control.compliantCount / control.total) * 100).toFixed(0);
                const isFullyCompliant = control.status === 'Compliant';

                return (
                  <div
                    key={control.name}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {isFullyCompliant ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-slate-200">{control.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 pl-5 block">
                        {control.compliantCount} of {control.total} devices compliant ({passRate}%)
                      </span>
                    </div>
                    <Badge variant={isFullyCompliant ? 'success' : 'warning'} className="text-[10px]">
                      {control.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Activity Stream Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Security Alerts (2 Cols) */}
        <Card className="lg:col-span-2 border-slate-800/90 bg-slate-900/40">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-200">Active Security Alerts</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    High-priority operational alerts requiring triage
                  </CardDescription>
                </div>
              </div>
              <Link to="/alerts">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 gap-1 p-0">
                  <span>View All Alerts ({telemetryData.openAlertsCount})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="divide-y divide-slate-800/80">
              {telemetryData.activeAlerts.map((alert) => (
                <div key={alert.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={alert.severity === 'critical' ? 'destructive' : 'warning'}
                        className="text-[10px] uppercase font-semibold tracking-wider"
                      >
                        {alert.severity}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-200 truncate">{alert.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span className="font-mono text-slate-300">{alert.hostname}</span>
                      <span>•</span>
                      <span>{alert.ipAddress}</span>
                      <span>•</span>
                      <span>{alert.time}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Triage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Administrator Action Center (1 Col) */}
        <Card className="border-slate-800/90 bg-slate-900/40">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">Admin Operations</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Quick shortcuts and system operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="space-y-2">
              <Link to="/devices" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 text-xs border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span>Enroll New Endpoint</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </Link>

              <Link to="/policies" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 text-xs border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Deploy Security Policy</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </Link>

              {hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']) && (
                <Link to="/users" className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-9 text-xs border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Manage Admin Users</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Environment Status
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Database Engine</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">PostgreSQL Ready</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Authentication Service</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">JWT / RBAC Active</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Agent Telemetry Daemon</span>
                  </span>
                  <span className="text-[11px] font-mono text-blue-400">Pipeline Staged</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Environment Activity Stream */}
      <Card className="border-slate-800/90 bg-slate-900/40">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">Recent Environment Activity</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Audit trail of endpoint events and administrator actions
                </CardDescription>
              </div>
            </div>
            <Link to="/audit-logs">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 gap-1 p-0">
                <span>View Full Audit Log</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="space-y-3">
            {telemetryData.recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      evt.status === 'success'
                        ? 'bg-emerald-400'
                        : evt.status === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-blue-400'
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-slate-200 mr-2">{evt.type}:</span>
                    <span className="text-slate-300">{evt.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 pl-5 sm:pl-0 shrink-0">
                  <span>By: <strong className="text-slate-300 font-normal">{evt.actor}</strong></span>
                  <span>•</span>
                  <span>{evt.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
