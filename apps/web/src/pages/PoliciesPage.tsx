import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Link2,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDeviceList } from '../hooks/useDeviceQueries';
import {
  useAssignPolicy,
  useCreatePolicy,
  useDeletePolicy,
  usePoliciesList,
  useUpdatePolicy,
} from '../hooks/usePolicies';
import type {
  CreatePolicyPayload,
  PolicySummary,
  PolicyType,
} from '../types/policy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

const inputClass =
  'w-full rounded-md bg-white border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50';

const typeOptions: PolicyType[] = ['SECURITY', 'CONFIGURATION', 'COMPLIANCE'];

function policyTypeBadgeVariant(type: string): BadgeVariant {
  switch (type) {
    case 'SECURITY':
      return 'destructive';
    case 'CONFIGURATION':
      return 'info';
    case 'COMPLIANCE':
      return 'purple';
    default:
      return 'secondary';
  }
}

interface PolicyFormState {
  name: string;
  type: PolicyType;
  description: string;
  isActive: boolean;
  settings: Record<string, unknown>;
}

const emptyForm: PolicyFormState = {
  name: '',
  type: 'SECURITY',
  description: '',
  isActive: true,
  settings: {},
};

function toFormState(policy: PolicySummary): PolicyFormState {
  return {
    name: policy.name,
    type: policy.type,
    description: policy.description ?? '',
    isActive: policy.isActive,
    settings: { ...(policy.settings ?? {}) },
  };
}

function buildSettings(type: PolicyType, settings: Record<string, unknown>): Record<string, unknown> {
  const num = (value: unknown): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const str = (value: unknown): string | undefined => {
    const v = typeof value === 'string' ? value.trim() : '';
    return v === '' ? undefined : v;
  };

  if (type === 'SECURITY') {
    return {
      firewallRequired: Boolean(settings.firewallRequired),
      antivirusRequired: Boolean(settings.antivirusRequired),
      ...(num(settings.autoLockMinutes) !== undefined ? { autoLockMinutes: num(settings.autoLockMinutes) } : {}),
      ...(str(settings.passwordComplexity) ? { passwordComplexity: str(settings.passwordComplexity) } : {}),
    };
  }
  if (type === 'COMPLIANCE') {
    return {
      ...(str(settings.minOsVersion) ? { minOsVersion: str(settings.minOsVersion) } : {}),
      ...(str(settings.minAgentVersion) ? { minAgentVersion: str(settings.minAgentVersion) } : {}),
      ...(num(settings.minDiskFreeGb) !== undefined ? { minDiskFreeGb: num(settings.minDiskFreeGb) } : {}),
    };
  }
  return {
    autoUpdates: Boolean(settings.autoUpdates),
    ...(str(settings.powerShellScript) ? { powerShellScript: str(settings.powerShellScript) } : {}),
  };
}

export function PoliciesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PolicyType | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyFormState>(emptyForm);
  const [assignPolicyId, setAssignPolicyId] = useState<string | null>(null);
  const [assignDeviceIds, setAssignDeviceIds] = useState<string[]>([]);
  const [assignPriority, setAssignPriority] = useState(100);
  const [removeMode, setRemoveMode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = usePoliciesList({ page: 1, limit: 100, search, type: typeFilter, includeAssignments: true });
  const createMutation = useCreatePolicy();
  const updateMutation = useUpdatePolicy();
  const deleteMutation = useDeletePolicy();
  const assignMutation = useAssignPolicy();

  const policies = useMemo(() => listQuery.data?.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.data?.total ?? 0;

  const devicesQuery = useDeviceList({ page: 1, limit: 100 });
  const devices = useMemo(() => devicesQuery.data?.devices ?? [], [devicesQuery.data]);
  const assignPolicy = useMemo(
    () => policies.find((p) => p.id === assignPolicyId) ?? null,
    [policies, assignPolicyId],
  );

  // Reset assign selection whenever the target policy changes.
  useEffect(() => {
    setAssignDeviceIds([]);
    setAssignPriority(100);
    setRemoveMode(false);
  }, [assignPolicyId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, type: 'SECURITY', settings: { firewallRequired: false, antivirusRequired: false } });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (policy: PolicySummary) => {
    setEditingId(policy.id);
    setForm(toFormState(policy));
    setFormError(null);
    setShowForm(true);
    setAssignPolicyId(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const setSetting = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  const changeType = (type: PolicyType) => {
    setForm((prev) => ({ ...prev, type, settings: {} }));
  };

  const handleSubmit = () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Policy name is required.');
      return;
    }
    const payload: CreatePolicyPayload = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      settings: buildSettings(form.type, form.settings),
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            closeForm();
          },
          onError: (err) => setFormError(err.message),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          closeForm();
        },
        onError: (err) => setFormError(err.message),
      });
    }
  };

  const handleDelete = (policy: PolicySummary) => {
    if (!window.confirm(`Delete policy "${policy.name}"? This also removes its assignments.`)) return;
    deleteMutation.mutate(policy.id);
  };

  const toggleDevice = (deviceId: string) => {
    setAssignDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  };

  const handleAssign = () => {
    if (assignDeviceIds.length === 0) return;
    assignMutation.mutate(
      {
        id: assignPolicyId!,
        payload: {
          deviceIds: assignDeviceIds,
          groupIds: [],
          priority: assignPriority,
          removeAssignment: removeMode,
        },
      },
      {
        onSuccess: () => {
          setAssignDeviceIds([]);
          setAssignPolicyId(null);
        },
      },
    );
  };

  const pending = createMutation.isPending || updateMutation.isPending;
  const actionPending = deleteMutation.isPending || assignMutation.isPending;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Configuration Policies
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50">
              {total} policies
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, assign, and enforce endpoint configuration profiles and security baselines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listQuery.isFetching && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
          {canManage && (
            <Button onClick={showForm && !editingId ? closeForm : openCreate}>
              {showForm && !editingId ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {showForm && !editingId ? 'Cancel' : 'New Policy'}
            </Button>
          )}
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {editingId ? 'Edit Policy' : 'Create Policy'}
            </CardTitle>
            <CardDescription>
              Settings are validated by type on the server. Changes apply to assigned endpoints at their next heartbeat or policy sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formError && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
                {formError}
              </div>
            )}
            {(createMutation.isError || updateMutation.isError) && !formError && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
                {(createMutation.error as Error)?.message ?? (updateMutation.error as Error)?.message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Baseline Security Policy"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Type</label>
                <select className={inputClass} value={form.type} onChange={(e) => changeType(e.target.value as PolicyType)}>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select
                  className={inputClass}
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'true' }))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Description</label>
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Optional purpose / scope of this policy"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Type-specific settings */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {form.type} Settings
              </span>

              {form.type === 'SECURITY' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.settings.firewallRequired)}
                      onChange={(e) => setSetting('firewallRequired', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Firewall required
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.settings.antivirusRequired)}
                      onChange={(e) => setSetting('antivirusRequired', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Antivirus required
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Auto lock (minutes)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={String(form.settings.autoLockMinutes ?? '')}
                      onChange={(e) => setSetting('autoLockMinutes', e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Password complexity</label>
                    <select
                      className={inputClass}
                      value={String(form.settings.passwordComplexity ?? '')}
                      onChange={(e) => setSetting('passwordComplexity', e.target.value || undefined)}
                    >
                      <option value="">Not set</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
              )}

              {form.type === 'CONFIGURATION' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.settings.autoUpdates)}
                      onChange={(e) => setSetting('autoUpdates', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Automatic OS updates enabled
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">PowerShell startup script (optional)</label>
                    <textarea
                      className={inputClass}
                      rows={3}
                      placeholder="Script executed by the agent at policy sync"
                      value={String(form.settings.powerShellScript ?? '')}
                      onChange={(e) => setSetting('powerShellScript', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {form.type === 'COMPLIANCE' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Min OS version</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. 10.0.19045"
                      value={String(form.settings.minOsVersion ?? '')}
                      onChange={(e) => setSetting('minOsVersion', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Min agent version</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. 0.1.0"
                      value={String(form.settings.minAgentVersion ?? '')}
                      onChange={(e) => setSetting('minAgentVersion', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Min free disk (GB)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={String(form.settings.minDiskFreeGb ?? '')}
                      onChange={(e) => setSetting('minDiskFreeGb', e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={pending || !form.name.trim()}>
                {pending ? 'Saving...' : editingId ? 'Save Changes' : 'Create Policy'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment panel */}
      {assignPolicy && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  Assign "{assignPolicy.name}"
                </CardTitle>
                <CardDescription>
                  Choose target endpoints, or remove existing assignments. Devices outside this policy organization are rejected by the server.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAssignPolicyId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Priority (0-1000)</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className={inputClass}
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(Number(e.target.value))}
                />
              </div>
              <label className="flex items-end gap-2 text-sm text-slate-700 pb-2">
                <input
                  type="checkbox"
                  checked={removeMode}
                  onChange={(e) => setRemoveMode(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Remove these assignments instead of adding
              </label>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {devicesQuery.isLoading && (
                <div className="p-4 space-y-2">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="h-6 rounded bg-slate-100 animate-pulse" />
                  ))}
                </div>
              )}
              {devicesQuery.isSuccess && devices.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No devices enrolled yet.</p>
              )}
              {devices.map((device) => {
                const current = assignPolicy.assignments?.some((a) => a.deviceId === device.id);
                return (
                  <label
                    key={device.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={assignDeviceIds.includes(device.id)}
                      onChange={() => toggleDevice(device.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 font-medium">{device.deviceName}</span>
                    <span className="text-xs text-slate-500 font-mono">{device.hostname}</span>
                    {current && (
                      <Badge variant="success" className="ml-auto text-[10px]">
                        Assigned
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPolicyId(null)}>
                Close
              </Button>
              <Button
                onClick={handleAssign}
                disabled={assignMutation.isPending || assignDeviceIds.length === 0}
              >
                {removeMode ? 'Remove' : 'Assign'} ({assignDeviceIds.length}){' '}
                {assignMutation.isPending ? '...' : ''}
              </Button>
            </div>
            {assignMutation.isError && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
                {(assignMutation.error as Error).message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${inputClass} w-auto`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PolicyType | 'ALL')}
        >
          <option value="ALL">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 text-base">Policies</CardTitle>
            {listQuery.isFetching && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && (
            <div className="space-y-3" data-testid="policies-loading">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {listQuery.isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="text-sm text-rose-600">{(listQuery.error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {listQuery.isSuccess && policies.length === 0 && (
            <div className="py-10 text-center">
              <ShieldCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">No policies match your filters.</p>
            </div>
          )}

          {listQuery.isSuccess && policies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-4 font-semibold">Name</th>
                    <th className="pb-2 pr-4 font-semibold">Type</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                    <th className="pb-2 pr-4 font-semibold">Assignments</th>
                    <th className="pb-2 pr-4 font-semibold">Created</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4">
                        <div className="text-slate-900 font-medium">{policy.name}</div>
                        {policy.description && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-md truncate">
                            {policy.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={policyTypeBadgeVariant(policy.type)} className="text-[10px] font-medium">
                          {policy.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={policy.isActive ? 'success' : 'secondary'} className="text-[10px] font-medium">
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 font-mono text-xs">
                        {policy.assignmentsCount ?? 0}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs font-mono">
                        {new Date(policy.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-blue-600"
                            onClick={() => {
                              setAssignPolicyId(policy.id);
                            }}
                            title="Assign / unassign"
                            disabled={!canManage}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-blue-600"
                              onClick={() => openEdit(policy)}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-rose-600"
                              onClick={() => handleDelete(policy)}
                              title="Delete"
                              disabled={actionPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endpoint quick links */}
      {policies.length > 0 && (
        <div className="text-xs text-slate-500">
          View assigned endpoints under{' '}
          <Link to="/devices" className="text-blue-600 hover:underline">
            Devices
          </Link>{' '}
          or check real-time violations on the{' '}
          <Link to="/compliance" className="text-blue-600 hover:underline">
            Compliance
          </Link>{' '}
          page.
        </div>
      )}
    </div>
  );
}