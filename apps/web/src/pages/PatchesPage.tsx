import { useEffect, useState, type FormEvent } from 'react';
import {
  Wrench,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  Search,
  Check,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import {
  useCreatePatch,
  useDeployPatch,
  usePatchList,
  useUpdatePatch,
} from '../hooks/usePatches';
import type { PatchCoverage, PatchSeverity, PatchStatus } from '../types/patch';

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'IMPORTANT', 'OPTIONAL'] as const;
const STATUS_OPTIONS = ['ALL', 'PENDING', 'APPROVED', 'DEPLOYED'] as const;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10);
}

function severityBadge(severity: PatchSeverity) {
  if (severity === 'CRITICAL') {
    return (
      <Badge variant="destructive" className="text-[10px]">
        CRITICAL
      </Badge>
    );
  }
  if (severity === 'IMPORTANT') {
    return (
      <Badge variant="warning" className="text-[10px]">
        IMPORTANT
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      OPTIONAL
    </Badge>
  );
}

const emptyForm = { kbNumber: '', title: '', severity: 'IMPORTANT' as PatchSeverity };

export function PatchesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('ALL');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deployTarget, setDeployTarget] = useState<PatchCoverage | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = usePatchList({
    search: debouncedSearch || undefined,
    severity: (severity || 'ALL') as PatchSeverity | 'ALL',
    status: (status || 'ALL') as PatchStatus | 'ALL',
    limit: 100,
  });

  const createMutation = useCreatePatch();
  const updateMutation = useUpdatePatch();
  const deployMutation = useDeployPatch();

  const response = listQuery.data?.data;
  const patches = response?.items ?? [];
  const summary = response?.summary;
  const loading = listQuery.isLoading;
  const isStale = listQuery.isFetching;
  const error = listQuery.error ? (listQuery.error as Error).message : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate(
      {
        kbNumber: form.kbNumber.trim(),
        title: form.title.trim(),
        severity: form.severity,
      },
      {
        onSuccess: () => {
          setForm(emptyForm);
          setShowAdd(false);
        },
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  const handleApprove = (patch: PatchCoverage) => {
    updateMutation.mutate({ patchId: patch.id, payload: { status: 'APPROVED' } });
  };

  const handleConfirmDeploy = () => {
    if (!deployTarget) return;
    const patchId = deployTarget.id;
    deployMutation.mutate(
      { patchId, payload: { confirmed: true } },
      { onSuccess: () => setDeployTarget(null) }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Patch Management
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50"
                >
                  {summary?.total ?? 0} patches
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review OS updates reported by agent scans, approve critical KBs and track deployment coverage.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void listQuery.refetch()}
            disabled={isStale}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isStale ? 'animate-spin' : ''}`} />
            <span>{isStale ? 'Syncing...' : 'Sync'}</span>
          </Button>

          {canManage && (
            <Button
              size="sm"
              onClick={() => setShowAdd((value) => !value)}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              {showAdd ? (
                <X className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{showAdd ? 'Cancel' : 'Add Patch'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Add patch panel */}
      {showAdd && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Add patch to catalog
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Agent scans create entries automatically; use this to pre-approve a known KB.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-kb">
                  KB number
                </label>
                <input
                  id="patch-kb"
                  required
                  placeholder="KB5034441"
                  value={form.kbNumber}
                  onChange={(event) => setForm({ ...form, kbNumber: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-title">
                  Title
                </label>
                <input
                  id="patch-title"
                  required
                  placeholder="Cumulative Security Update for Windows 11"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-severity">
                  Severity
                </label>
                <select
                  id="patch-severity"
                  value={form.severity}
                  onChange={(event) =>
                    setForm({ ...form, severity: event.target.value as PatchSeverity })
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="IMPORTANT">IMPORTANT</option>
                  <option value="OPTIONAL">OPTIONAL</option>
                </select>
              </div>

              {formError && (
                <div className="sm:col-span-12 text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="sm:col-span-12 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  {createMutation.isPending ? 'Adding...' : 'Add Patch'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Feedback banners */}
      {updateMutation.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{updateMutation.data.kbNumber} is now {updateMutation.data.status.toLowerCase()}.</span>
        </div>
      )}

      {deployMutation.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Queued installation of {deployMutation.data.patch.kbNumber} on{' '}
            {deployMutation.data.queued} device{deployMutation.data.queued === 1 ? '' : 's'}
            {deployMutation.data.skippedInstalled > 0 &&
              ` · ${deployMutation.data.skippedInstalled} already installed`}
            {deployMutation.data.skippedInFlight > 0 &&
              ` · ${deployMutation.data.skippedInFlight} already in flight`}
            . Agents pick commands up on their next heartbeat.
          </span>
        </div>
      )}

      {(updateMutation.isError || deployMutation.isError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 shadow-xs">
          {((updateMutation.error ?? deployMutation.error) as Error).message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 shadow-xs">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Critical Patches
              </span>
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600 tracking-tight">{summary?.critical ?? 0}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Security Hotfixes</span>
              <span className="text-red-700 font-semibold">Immediate</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Important
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">
              {summary?.important ?? 0}
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Quality &amp; Drivers</span>
              <span className="text-amber-700 font-semibold">Recommended</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Optional
              </span>
              <Wrench className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{summary?.optional ?? 0}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Feature Updates</span>
              <span className="text-slate-600 font-medium">Staged</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Up-To-Date Fleet
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {summary?.upToDatePercent === null || summary?.upToDatePercent === undefined
                ? '—'
                : `${summary.upToDatePercent}%`}
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Target &gt;95%</span>
              <span className="text-emerald-700 font-semibold">Healthy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by KB number or update title..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search patches"
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          />
        </div>

        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as (typeof SEVERITY_OPTIONS)[number])}
          aria-label="Severity filter"
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'ALL' ? 'All severities' : option}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
          aria-label="Status filter"
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'ALL' ? 'All statuses' : option}
            </option>
          ))}
        </select>
      </div>

      {/* Deploy confirmation */}
      {deployTarget && (
        <Card className="border-blue-200 bg-blue-50/50 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm text-blue-900">
              Deploy <span className="font-semibold">{deployTarget.kbNumber}</span> to{' '}
              {deployTarget.affectedDevices} device
              {deployTarget.affectedDevices === 1 ? '' : 's'} that do not have it installed? An{' '}
              <span className="font-mono">INSTALL_PATCH</span> command is queued for each one.
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleConfirmDeploy}
                disabled={deployMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="w-4 h-4 mr-1" />
                {deployMutation.isPending ? 'Queueing...' : 'Confirm deploy'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeployTarget(null)}
                disabled={deployMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patch list */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            Pending &amp; Available Software Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !response ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : patches.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {debouncedSearch || severity !== 'ALL' || status !== 'ALL'
                ? 'No patches match the current filters.'
                : 'No patches reported yet. Agents upload installed KBs with their next telemetry heartbeat.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {patches.map((patch) => (
                <div
                  key={patch.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs bg-slate-100 text-slate-800"
                      >
                        {patch.kbNumber}
                      </Badge>
                      {severityBadge(patch.severity)}
                      <span className="text-xs text-slate-400">
                        • Released {formatDate(patch.releaseDate)}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900">{patch.title}</h4>
                    <p className="text-xs text-slate-500">
                      Category: {patch.category} • Installed on {patch.installedCount} of{' '}
                      {patch.totalDevices} devices •{' '}
                      <span className={patch.affectedDevices > 0 ? 'text-rose-600 font-medium' : ''}>
                        {patch.affectedDevices} requiring update
                      </span>
                      {patch.failedCount > 0 && (
                        <span className="text-amber-600"> • {patch.failedCount} failed</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {patch.status === 'PENDING' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(patch)}
                        disabled={!canManage || updateMutation.isPending}
                        className="text-blue-600 hover:bg-blue-50 border-blue-200"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    ) : patch.status === 'APPROVED' ? (
                      <Button
                        size="sm"
                        onClick={() => setDeployTarget(patch)}
                        disabled={!canManage || patch.affectedDevices === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Deploy Now
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs py-1 px-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Deployed
                        </Badge>
                        {patch.affectedDevices > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeployTarget(patch)}
                            disabled={!canManage}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Redeploy
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
