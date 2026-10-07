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
  Trash2,
  RotateCcw,
  Ban,
  Eye,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import {
  useCancelPatchDeploy,
  useCreatePatch,
  useDeletePatch,
  useDeployPatch,
  usePatch,
  usePatchList,
  useRetryPatch,
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

const emptyForm = {
  kbNumber: '',
  title: '',
  severity: 'IMPORTANT' as PatchSeverity,
  description: '',
  category: '',
  releaseDate: '',
};

export function PatchesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('ALL');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deployTarget, setDeployTarget] = useState<PatchCoverage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatchCoverage | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approvingPatchId, setApprovingPatchId] = useState<string | null>(null);
  const [approveNotice, setApproveNotice] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = usePatchList({
    search: debouncedSearch || undefined,
    severity: (severity || 'ALL') as PatchSeverity | 'ALL',
    status: (status || 'ALL') as PatchStatus | 'ALL',
    page,
    limit: 20,
  });

  const detailQuery = usePatch(detailId ?? undefined);

  const createMutation = useCreatePatch();
  const updateMutation = useUpdatePatch();
  const deployMutation = useDeployPatch();
  const retryMutation = useRetryPatch();
  const cancelMutation = useCancelPatchDeploy();
  const deleteMutation = useDeletePatch();

  const response = listQuery.data?.data;
  const patches = response?.items ?? [];
  const summary = response?.summary;
  const total = response?.total ?? 0;
  const loading = listQuery.isLoading;
  const isStale = listQuery.isFetching;
  const error = listQuery.error ? (listQuery.error as Error).message : null;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, severity, status]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate(
      {
        kbNumber: form.kbNumber.trim(),
        title: form.title.trim(),
        severity: form.severity,
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        releaseDate: form.releaseDate || undefined,
      },
      {
        onSuccess: () => {
          setForm(emptyForm);
          setShowAdd(false);
          setActionNotice('Patch added to catalog.');
        },
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  const handleApprove = (patch: PatchCoverage) => {
    if (!canManage || approvingPatchId) return;
    setApprovingPatchId(patch.id);
    setApproveError(null);
    updateMutation.mutate(
      { patchId: patch.id, payload: { status: 'APPROVED' } },
      {
        onSuccess: (data) => {
          setApproveNotice(`Patch ${data.kbNumber} ("${patch.title}") was successfully approved.`);
          setApprovingPatchId(null);
        },
        onError: (err) => {
          setApproveError((err as Error).message || 'Failed to approve patch');
          setApprovingPatchId(null);
        },
      }
    );
  };

  const handleConfirmDeploy = () => {
    if (!deployTarget) return;
    const patchId = deployTarget.id;
    deployMutation.mutate(
      { patchId, payload: { confirmed: true } },
      {
        onSuccess: (data) => {
          setDeployTarget(null);
          setActionNotice(`Deployment queued for ${data.queued} device(s).`);
        },
      }
    );
  };

  const handleRetry = (patch: PatchCoverage) => {
    retryMutation.mutate(patch.id, {
      onSuccess: (data) => setActionNotice(`Retry queued for ${data.retried} device(s).`),
    });
  };

  const handleCancel = (patch: PatchCoverage) => {
    cancelMutation.mutate(patch.id, {
      onSuccess: (data) => setActionNotice(`Cancelled ${data.cancelled} queued install(s).`),
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (data) => {
        setActionNotice(`Patch ${data.kbNumber} deleted.`);
        setDeleteTarget(null);
        if (detailId === deleteTarget.id) setDetailId(null);
      },
    });
  };

  const detail = detailQuery.data?.data;

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

      {/* Feedback banners */}
      {actionNotice && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button type="button" onClick={() => setActionNotice(null)} className="font-semibold">Dismiss</button>
        </div>
      )}
      {approveNotice && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{approveNotice}</span>
          </div>
          <button type="button" onClick={() => setApproveNotice(null)} className="font-semibold">Dismiss</button>
        </div>
      )}
      {approveError && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">Approval failed: {approveError}</span>
          </div>
          <button type="button" onClick={() => setApproveError(null)} className="font-semibold">Dismiss</button>
        </div>
      )}

      {/* Deployment Feedback Banner */}
      {deployMutation.isError && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">
              Deployment failed: {(deployMutation.error as Error).message}
            </span>
          </div>
          <button onClick={() => deployMutation.reset()} className="font-semibold">Dismiss</button>
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={Boolean(deployTarget)}
        onOpenChange={(open) => { if (!open) setDeployTarget(null); }}
        title={deployTarget ? `Deploy ${deployTarget.kbNumber}` : 'Deploy Patch'}
        description={
          deployTarget
            ? `Deploying "${deployTarget.title}" will issue remote install commands to all ${
                deployTarget.affectedDevices > 0 ? `${deployTarget.affectedDevices} unpatched` : 'eligible'
              } endpoints. System restarts may be required on target devices.`
            : ''
        }
        icon={Wrench}
        variant="warning"
        confirmLabel="Deploy Patch"
        loading={deployMutation.isPending}
        onConfirm={handleConfirmDeploy}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget ? `Delete ${deleteTarget.kbNumber}` : 'Delete Patch'}
        description={deleteTarget ? `Remove "${deleteTarget.title}" from the catalog? Devices that already installed it keep their history, but the catalog entry and MISSING rows are removed.` : ''}
        icon={Trash2}
        variant="danger"
        confirmLabel="Delete Patch"
        loading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      {/* Add patch panel */}
      {showAdd && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-900">Add patch to catalog</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Agent scans create entries automatically; use this to pre-approve a known KB.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-kb">KB number</label>
                <input id="patch-kb" required placeholder="KB5034441" value={form.kbNumber}
                  onChange={(event) => setForm({ ...form, kbNumber: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
              </div>
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-title">Title</label>
                <input id="patch-title" required placeholder="Cumulative Security Update for Windows 11" value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-severity">Severity</label>
                <select id="patch-severity" value={form.severity}
                  onChange={(event) => setForm({ ...form, severity: event.target.value as PatchSeverity })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="IMPORTANT">IMPORTANT</option>
                  <option value="OPTIONAL">OPTIONAL</option>
                </select>
              </div>
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-category">Category</label>
                <input id="patch-category" placeholder="Security Updates" value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
              </div>
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-date">Release date</label>
                <input id="patch-date" type="date" value={form.releaseDate}
                  onChange={(event) => setForm({ ...form, releaseDate: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
              </div>
              <div className="sm:col-span-12">
                <label className="text-xs font-semibold text-slate-700" htmlFor="patch-desc">Description</label>
                <textarea id="patch-desc" rows={2} placeholder="What does this update fix?" value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
              </div>
              {formError && (
                <div className="sm:col-span-12 text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">{formError}</div>
              )}
              <div className="sm:col-span-12 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs border-slate-200">Cancel</Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  {createMutation.isPending ? 'Adding...' : 'Add Patch'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 shadow-xs">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Patches</span>
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600 tracking-tight">{summary?.critical ?? 0}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Security Hotfixes</span><span className="text-red-700 font-semibold">Immediate</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Important</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">{summary?.important ?? 0}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Quality &amp; Drivers</span><span className="text-amber-700 font-semibold">Recommended</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Optional</span>
              <Wrench className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{summary?.optional ?? 0}</div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Feature Updates</span><span className="text-slate-600 font-medium">Staged</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Up-To-Date Fleet</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {summary?.upToDatePercent === null || summary?.upToDatePercent === undefined ? '—' : `${summary.upToDatePercent}%`}
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Target &gt;95%</span><span className="text-emerald-700 font-semibold">Healthy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by KB number or update title..." value={search}
            onChange={(event) => setSearch(event.target.value)} aria-label="Search patches"
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs" />
        </div>
        <select value={severity} onChange={(event) => setSeverity(event.target.value as (typeof SEVERITY_OPTIONS)[number])}
          aria-label="Severity filter"
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          {SEVERITY_OPTIONS.map((option) => (<option key={option} value={option}>{option === 'ALL' ? 'All severities' : option}</option>))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
          aria-label="Status filter"
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          {STATUS_OPTIONS.map((option) => (<option key={option} value={option}>{option === 'ALL' ? 'All statuses' : option}</option>))}
        </select>
      </div>

      {/* Patch list */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3">
          <CardTitle className="text-sm font-bold text-slate-800">Pending &amp; Available Software Updates ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !response ? (
            <div className="p-4 space-y-3">{[0, 1, 2].map((row) => (<div key={row} className="h-16 rounded-lg bg-slate-100 animate-pulse" />))}</div>
          ) : patches.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {debouncedSearch || severity !== 'ALL' || status !== 'ALL'
                ? 'No patches match the current filters.'
                : 'No patches reported yet. Agents upload installed KBs with their next telemetry heartbeat.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {patches.map((patch) => (
                <div key={patch.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-800">{patch.kbNumber}</Badge>
                      {severityBadge(patch.severity)}
                      <span className="text-xs text-slate-400">• Released {formatDate(patch.releaseDate)}</span>
                      <span className="text-xs text-slate-400">• {patch.status}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{patch.title}</h4>
                    <p className="text-xs text-slate-500">
                      Category: {patch.category} • Installed on {patch.installedCount} of {patch.totalDevices} devices •{' '}
                      <span className={patch.affectedDevices > 0 ? 'text-rose-600 font-medium' : ''}>{patch.affectedDevices} requiring update</span>
                      {patch.failedCount > 0 && (<span className="text-amber-600"> • {patch.failedCount} failed</span>)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setDetailId(patch.id)} className="gap-1.5">
                      <Eye className="w-4 h-4" /><span>Details</span>
                    </Button>
                    {patch.status === 'PENDING' ? (
                      <Button variant="outline" size="sm" onClick={() => handleApprove(patch)}
                        disabled={!canManage || Boolean(approvingPatchId)} className="text-blue-600 hover:bg-blue-50 border-blue-200 gap-1.5">
                        {approvingPatchId === patch.id ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Approving...</span></>) : (<><Check className="w-4 h-4" /><span>Approve</span></>)}
                      </Button>
                    ) : patch.status === 'APPROVED' ? (
                      <Button size="sm" onClick={() => setDeployTarget(patch)} disabled={!canManage || patch.affectedDevices === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Play className="w-4 h-4 mr-1" />Deploy Now
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs py-1 px-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Deployed
                        </Badge>
                        {patch.affectedDevices > 0 && (
                          <Button variant="outline" size="sm" onClick={() => setDeployTarget(patch)} disabled={!canManage}>
                            <Play className="w-4 h-4 mr-1" />Redeploy
                          </Button>
                        )}
                      </div>
                    )}
                    {patch.failedCount > 0 && (
                      <Button variant="outline" size="sm" onClick={() => handleRetry(patch)} disabled={!canManage || retryMutation.isPending}
                        className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50">
                        <RotateCcw className="w-4 h-4" /><span>Retry failed</span>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleCancel(patch)} disabled={!canManage || cancelMutation.isPending}
                      className="gap-1.5" title="Cancel queued installs">
                      <Ban className="w-4 h-4" /><span>Cancel</span>
                    </Button>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(patch)} disabled={deleteMutation.isPending}
                        className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span className="text-xs text-slate-500 font-medium">Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
        <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>

      {/* Detail drawer */}
      {detailId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Patch details</h3>
              <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {detailQuery.isLoading ? (
              <div className="text-xs text-slate-500">Loading coverage…</div>
            ) : detail ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{detail.kbNumber}</Badge>
                    {severityBadge(detail.status as unknown as PatchSeverity)}
                    <Badge variant="outline">{detail.status}</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{detail.title}</h4>
                  <p className="text-xs text-slate-500">{detail.description || 'No description.'}</p>
                  <p className="text-xs text-slate-500">Category: {detail.category} • Released {formatDate(detail.releaseDate)}</p>
                  <p className="text-xs text-slate-500">
                    Installed {detail.summary.installed}/{detail.summary.totalDevices} • Missing {detail.summary.missing} • Failed {detail.summary.failed} • In-flight {detail.summary.inFlight}
                  </p>
                </div>
                <div className="space-y-2">
                  {detail.devices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{d.deviceName || d.hostname}</p>
                        <p className="text-slate-500 font-mono">{d.hostname} • {d.ipAddress}</p>
                      </div>
                      <Badge variant="outline" className={
                        d.patchStatus === 'INSTALLED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : d.patchStatus === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                      }>{d.patchStatus}{d.command ? ` • ${d.command.status}` : ''}</Badge>
                    </div>
                  ))}
                  {detail.devices.length === 0 && (<p className="text-xs text-slate-500">No devices in this organization yet.</p>)}
                </div>
              </>
            ) : (
              <p className="text-xs text-rose-600">Failed to load patch details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
