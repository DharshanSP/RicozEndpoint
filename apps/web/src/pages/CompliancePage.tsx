import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Server,
  AlertTriangle,
  ArrowUpRight,
  PlayCircle,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { useComplianceRollup, useEvaluateCompliance } from '../hooks/useCompliance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select } from '../components/ui/select';
import { formatRelativeTime } from '../lib/format';
import type { ComplianceRange } from '../types/compliance';

const RANGE_OPTIONS: Array<{ value: ComplianceRange; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

export function CompliancePage() {
  const { hasRole } = useAuth();
  const [range, setRange] = useState<ComplianceRange>('24h');

  const rollupQuery = useComplianceRollup({ range, status: 'NON_COMPLIANT', limit: 50 });
  const dashboard = useDashboardData('24h');
  const evaluateMutation = useEvaluateCompliance();

  const rollup = rollupQuery.data?.data;
  const summary = rollup?.summary;
  const controls = rollup?.controls ?? [];
  const nonCompliant = rollup?.devices ?? [];

  const loading = rollupQuery.isLoading;
  const error = rollupQuery.error
    ? (rollupQuery.error as Error).message
    : dashboard.error;
  const isStale = rollupQuery.isFetching || dashboard.loading;

  const canEvaluate = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

  const { refetch } = rollupQuery;
  const dashboardRefresh = dashboard.refresh;
  const refresh = useCallback(() => {
    void refetch();
    void dashboardRefresh();
  }, [refetch, dashboardRefresh]);

  const handleEvaluate = useCallback(() => {
    evaluateMutation.mutate({ all: true });
  }, [evaluateMutation]);

  const totalDevices = summary?.totalDevices ?? 0;
  const compliantDevices = summary?.compliant ?? 0;
  const nonCompliantDevices = summary?.nonCompliant ?? 0;
  const untestedDevices = summary?.untested ?? 0;
  const failedActions = dashboard.data?.failedActionsCount ?? 0;
  const complianceScore = rollup?.score ?? dashboard.data?.complianceScore ?? 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Compliance Overview
                </h1>
                <Badge variant="outline" className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50">
                  {totalDevices} endpoints
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit and enforce organizational security standards across the fleet.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value as ComplianceRange)}
            aria-label="Reporting range"
            wrapperClassName="w-auto"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isStale}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isStale ? 'animate-spin' : ''}`} />
            <span>{isStale ? 'Refreshing...' : 'Sync'}</span>
          </Button>

          {canEvaluate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={evaluateMutation.isPending || totalDevices === 0}
              className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
            >
              <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>{evaluateMutation.isPending ? 'Evaluating...' : 'Re-evaluate'}</span>
            </Button>
          )}
        </div>
      </div>

      {evaluateMutation.isSuccess && (
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-xs">
          <CardContent className="p-4 text-sm text-emerald-700">
            Re-evaluated {evaluateMutation.data.evaluated} device
            {evaluateMutation.data.evaluated === 1 ? '' : 's'} —{' '}
            {evaluateMutation.data.violations} failing check
            {evaluateMutation.data.violations === 1 ? '' : 's'} found.
          </CardContent>
        </Card>
      )}

      {evaluateMutation.isError && (
        <Card className="border-rose-200 bg-rose-50/50 shadow-xs">
          <CardContent className="p-4 text-sm text-rose-700">
            {(evaluateMutation.error as Error).message}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50/50 shadow-xs">
          <CardContent className="p-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Compliance Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className={`text-2xl font-bold tracking-tight ${complianceScore >= 90 ? 'text-emerald-600' : complianceScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
              {complianceScore}%
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{untestedDevices} not yet evaluated</span>
              <span className={complianceScore >= 90 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                {complianceScore >= 90 ? 'Passing' : 'Review Needed'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Compliant Devices</span>
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">{compliantDevices}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
              Pass latest policy evaluation
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Non-Compliant</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-600 tracking-tight">{nonCompliantDevices}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
              Violating at least one check
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Failed Actions</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">{failedActions}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
              Remote commands failed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance controls + non-compliant list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Compliance Controls</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Per-policy and per-rule pass rate across the fleet
                </CardDescription>
              </div>
              <Link to="/policies">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 px-2">
                  <span>Manage Policies</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {loading && !rollup && (
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && controls.length === 0 && (
              <div className="py-6 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">
                  No evaluation evidence yet. Assign a policy under{' '}
                  <Link to="/policies" className="text-blue-600 hover:underline">
                    Policies
                  </Link>{' '}
                  — compliance is evaluated on each agent heartbeat.
                </p>
              </div>
            )}

            {controls.length > 0 && (
              <div className="space-y-2">
                {controls.map((control) => {
                  const total = control.compliantCount + control.nonCompliantCount;
                  const passRate = total > 0 ? ((control.compliantCount / total) * 100).toFixed(0) : '—';
                  const isCompliant = control.status === 'COMPLIANT';
                  const passPercent = total > 0 ? (control.compliantCount / total) * 100 : 0;
                  const label =
                    control.status === 'NOT_EVALUATED' ? 'Not Evaluated' : isCompliant ? 'Compliant' : 'At Risk';

                  return (
                    <div key={control.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isCompliant ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : control.status === 'NOT_EVALUATED' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate">{control.name}</span>
                          <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 bg-white shrink-0">
                            {control.kind === 'POLICY' ? 'Policy' : 'Rule'}
                          </Badge>
                        </div>
                        <Badge
                          variant={isCompliant ? 'success' : control.status === 'NOT_EVALUATED' ? 'secondary' : 'warning'}
                          className="text-[10px]"
                        >
                          {label}
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isCompliant ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${passPercent}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1.5">
                        {control.status === 'NOT_EVALUATED'
                          ? `No evaluations yet — ${control.untestedCount} device${control.untestedCount === 1 ? '' : 's'} pending`
                          : `${control.compliantCount} of ${total} compliant (${passRate}%)`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Non-Compliant Devices</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Endpoints currently flagged as violating a policy
                </CardDescription>
              </div>
              <Link to="/devices">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 px-2">
                  <span>All Devices</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {loading && !rollup && (
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}

            {rollupQuery.isSuccess && nonCompliant.length === 0 && (
              <div className="py-6 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm text-slate-500">No non-compliant devices. Fleet is aligned with baseline policies.</p>
              </div>
            )}

            {nonCompliant.length > 0 && (
              <div className="divide-y divide-slate-100">
                {nonCompliant.map((device) => (
                  <Link
                    key={device.id}
                    to={`/devices/${device.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-md"
                  >
                    <span className="p-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 shrink-0">
                      <Server className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">{device.deviceName}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {device.hostname} • {device.os} {device.osVersion}
                      </div>
                      {device.reason && (
                        <div className="text-[11px] text-rose-600 truncate mt-0.5">
                          {device.violations} failing check{device.violations === 1 ? '' : 's'} — {device.reason}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 shrink-0 text-right">
                      {device.lastSeenAt ? `Seen ${formatRelativeTime(device.lastSeenAt)}` : 'Never seen'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
