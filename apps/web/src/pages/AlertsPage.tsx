import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  Server,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useAcknowledgeAlert,
  useAlertsList,
  useBatchResolveAlerts,
  useResolveAlert,
} from '../hooks/useAlerts';
import type { AlertItem, AlertSeverity, AlertStatus, AlertType } from '../types/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Pagination } from '../components/ui/Pagination';
import { PageHeader } from '../components/ui/PageHeader';
import { AlertBanner } from '../components/ui/AlertBanner';
import { formatDateTime, formatRelativeTime } from '../lib/format';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

type StatusFilter = 'UNRESOLVED' | AlertStatus | 'ALL';

const PAGE_SIZE = 20;

function severityBadgeVariant(severity: string): BadgeVariant {
  switch (severity) {
    case 'CRITICAL':
      return 'destructive';
    case 'WARNING':
      return 'warning';
    case 'INFO':
      return 'info';
    default:
      return 'secondary';
  }
}

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === 'RESOLVED') return 'success';
  if (status === 'ACKNOWLEDGED') return 'warning';
  return 'destructive';
}

export function AlertsPage() {
  const { hasRole } = useAuth();
  const canResolve = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);
  const canAcknowledge = canResolve || hasRole(['OPERATOR']);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('UNRESOLVED');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNote, setBulkNote] = useState('');

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const listQuery = useAlertsList({
    page,
    limit: PAGE_SIZE,
    status: statusFilter === 'UNRESOLVED' ? undefined : statusFilter,
    unresolved: statusFilter === 'UNRESOLVED' ? true : undefined,
    severity: severityFilter,
    type: typeFilter,
    search: search || undefined,
  });
  const resolveMutation = useResolveAlert();
  const acknowledgeMutation = useAcknowledgeAlert();
  const bulkMutation = useBatchResolveAlerts();

  const alerts = useMemo(() => listQuery.data?.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const allSelected = alerts.length > 0 && alerts.every((alert) => selected.has(alert.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(alerts.map((alert) => alert.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResolve = (alert: AlertItem) => {
    if (!canResolve || resolveMutation.isPending || acknowledgingId) return;
    setActionError(null);
    resolveMutation.mutate(
      { id: alert.id, payload: { note: resolveNote.trim() || undefined } },
      {
        onSuccess: () => {
          setResolveTarget(null);
          setResolveNote('');
          setActionSuccess(`Alert "${alert.title}" was successfully resolved.`);
        },
        onError: (err) => {
          setActionError((err as Error).message || 'Failed to resolve alert');
        },
      },
    );
  };

  const handleAcknowledge = (alert: AlertItem) => {
    if (!canAcknowledge || acknowledgingId || resolveMutation.isPending) return;
    setAcknowledgingId(alert.id);
    setActionError(null);
    acknowledgeMutation.mutate(alert.id, {
      onSuccess: () => {
        setActionSuccess(`Alert "${alert.title}" was successfully acknowledged.`);
        setAcknowledgingId(null);
      },
      onError: (err) => {
        setActionError((err as Error).message || 'Failed to acknowledge alert');
        setAcknowledgingId(null);
      },
    });
  };

  const handleBulkResolve = () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || bulkMutation.isPending) return;
    setActionError(null);
    bulkMutation.mutate(
      { ids, note: bulkNote.trim() || undefined },
      {
        onSuccess: () => {
          const count = ids.length;
          setBulkOpen(false);
          setBulkNote('');
          setSelected(new Set());
          setActionSuccess(`Successfully resolved ${count} alert${count === 1 ? '' : 's'}.`);
        },
        onError: (err) => {
          setActionError((err as Error).message || 'Failed to resolve selected alerts');
        },
      },
    );
  };

  const resetFilters = () => {
    setStatusFilter('UNRESOLVED');
    setSeverityFilter('ALL');
    setTypeFilter('ALL');
    setSearch('');
    setPage(1);
    setSelected(new Set());
  };

  const counts = useMemo(
    () => ({
      unresolved: alerts.filter((a) => a.status !== 'RESOLVED').length,
      critical: alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length,
      acknowledged: alerts.filter((a) => a.status === 'ACKNOWLEDGED').length,
    }),
    [alerts],
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        icon={Bell}
        title="Security & Operational Alerts"
        badge={
          <Badge variant="outline" className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50">
            {total} matching
          </Badge>
        }
        description="Real-time incident detection, severity classification, and administrator triage workflows."
        actions={
          <div className="flex items-center gap-2">
            {listQuery.isFetching && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
            <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200 bg-white shadow-xs" onClick={() => void listQuery.refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Success banner */}
      {actionSuccess && (
        <AlertBanner
          variant="success"
          message={actionSuccess}
          dismissible
          onDismiss={() => setActionSuccess(null)}
        />
      )}

      {/* Error banner */}
      {actionError && (
        <AlertBanner
          variant="error"
          message={actionError}
          dismissible
          onDismiss={() => setActionError(null)}
        />
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unresolved (page)</span>
            <div className="text-2xl font-bold text-rose-600">{counts.unresolved}</div>
            <span className="text-[11px] text-slate-500">Current page</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Critical (page)</span>
            <div className="text-2xl font-bold text-amber-600">{counts.critical}</div>
            <span className="text-[11px] text-slate-500">Still open</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Acknowledged (page)</span>
            <div className="text-2xl font-bold text-slate-900">{counts.acknowledged}</div>
            <span className="text-[11px] text-slate-500">Triaged, not resolved</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Triage Access</span>
            <div className="text-sm font-bold text-slate-900">
              {canResolve ? 'Resolve enabled' : canAcknowledge ? 'Acknowledge only' : 'Read only'}
            </div>
            <span className="text-[11px] text-slate-500">
              {canResolve ? 'IT_ADMIN or above' : canAcknowledge ? 'OPERATOR or above' : 'Requires OPERATOR role'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search alert titles..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          wrapperClassName="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
            setSelected(new Set());
          }}
        >
          <option value="UNRESOLVED">Unresolved</option>
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
        <Select
          wrapperClassName="w-auto"
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value as AlertSeverity | 'ALL');
            setPage(1);
          }}
        >
          <option value="ALL">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </Select>
        <Select
          wrapperClassName="w-auto"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as AlertType | 'ALL');
            setPage(1);
          }}
        >
          <option value="ALL">All types</option>
          <option value="COMPLIANCE_VIOLATION">Compliance violation</option>
          <option value="DEVICE_OFFLINE">Device offline</option>
          <option value="COMMAND_FAILED">Command failed</option>
          <option value="SECURITY">Security</option>
          <option value="POLICY">Policy</option>
          <option value="INFO">Info</option>
        </Select>
        {(statusFilter !== 'UNRESOLVED' ||
          severityFilter !== 'ALL' ||
          typeFilter !== 'ALL' ||
          search !== '') && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
        {canResolve && selected.size > 0 && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setBulkOpen(true)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Resolve selected ({selected.size})
          </Button>
        )}
      </div>

      {/* List */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-900 text-base">Alert Queue</CardTitle>
          <CardDescription>
            Acknowledge alerts to mark them triaged; resolve them once remediation is complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all alerts on this page"
              />
              <span className="text-[11px] text-slate-500">
                {selected.size > 0 ? `${selected.size} selected` : 'Select all on page'}
              </span>
            </div>
          )}

          {listQuery.isLoading && (
            <div className="space-y-3" data-testid="alerts-loading">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 rounded-md bg-slate-100 animate-pulse" />
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

          {listQuery.isSuccess && alerts.length === 0 && (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">No alerts match your filters.</p>
            </div>
          )}

          {listQuery.isSuccess && alerts.length > 0 && (
            <div className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  selected={selected.has(alert.id)}
                  onToggle={() => toggleOne(alert.id)}
                  canResolve={canResolve}
                  canAcknowledge={canAcknowledge}
                  resolving={resolveMutation.isPending && resolveTarget === alert.id}
                  acknowledging={acknowledgingId === alert.id}
                  expanding={resolveTarget === alert.id}
                  note={resolveNote}
                  onNoteChange={setResolveNote}
                  onStartResolve={() => {
                    setResolveTarget(alert.id);
                    setResolveNote('');
                  }}
                  onCancelResolve={() => {
                    setResolveTarget(null);
                    setResolveNote('');
                  }}
                  onConfirmResolve={() => handleResolve(alert)}
                  onAcknowledge={() => handleAcknowledge(alert)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="alerts"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk resolve modal */}
      {bulkOpen && canResolve && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setBulkOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900">
              Resolve {selected.size} alert{selected.size === 1 ? '' : 's'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Resolved alerts are removed from the unresolved queue and recorded with your account.
            </p>
            <label className="block text-xs font-medium text-slate-600 mt-4 mb-1">Resolution note (optional)</label>
            <Textarea
              rows={3}
              placeholder="What action was taken?"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(false)} disabled={bulkMutation.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBulkResolve} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? 'Resolving...' : 'Confirm Resolve'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  selected,
  onToggle,
  canResolve,
  canAcknowledge,
  resolving,
  acknowledging,
  expanding,
  note,
  onNoteChange,
  onStartResolve,
  onCancelResolve,
  onConfirmResolve,
  onAcknowledge,
}: {
  alert: AlertItem;
  selected: boolean;
  onToggle: () => void;
  canResolve: boolean;
  canAcknowledge: boolean;
  resolving: boolean;
  acknowledging: boolean;
  expanding: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onStartResolve: () => void;
  onCancelResolve: () => void;
  onConfirmResolve: () => void;
  onAcknowledge: () => void;
}) {
  const isOpen = alert.status === 'OPEN';
  const isAcknowledged = alert.status === 'ACKNOWLEDGED';

  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        {canResolve && (
          <input
            type="checkbox"
            className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select alert ${alert.title}`}
          />
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={severityBadgeVariant(String(alert.severity))} className="text-[10px] uppercase font-semibold tracking-wider">
              {alert.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono text-slate-600 bg-slate-50 border-slate-200">
              {alert.type}
            </Badge>
            <Badge variant={statusBadgeVariant(String(alert.status))} className="text-[10px] font-medium">
              {alert.status}
            </Badge>
            <span className="text-xs font-semibold text-slate-900 truncate">{alert.title}</span>
          </div>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{alert.message}</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <Server className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-slate-700 font-medium">
              {alert.device ? alert.device.hostname : 'Unknown host'}
            </span>
            {alert.device && (
              <>
                <span>•</span>
                <span>{alert.device.ipAddress}</span>
              </>
            )}
            <span>•</span>
            <span title={formatDateTime(alert.createdAt)}>{formatRelativeTime(alert.createdAt)}</span>
            {alert.acknowledgedAt && (
              <>
                <span>•</span>
                <span className="text-amber-600">
                  Acknowledged {formatRelativeTime(alert.acknowledgedAt)}
                  {alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ''}
                </span>
              </>
            )}
            {alert.resolvedAt && (
              <>
                <span>•</span>
                <span className="text-emerald-600">
                  Resolved {formatRelativeTime(alert.resolvedAt)}
                  {alert.resolvedBy ? ` by ${alert.resolvedBy}` : ''}
                </span>
              </>
            )}
          </div>
          {alert.resolvedNote && (
            <p className="text-[11px] text-slate-500 italic">Note: {alert.resolvedNote}</p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
          {alert.device && (
            <Link to={`/devices/${alert.device.id}`}>
              <Button variant="outline" size="sm" className="h-7 text-[11px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                View Device
              </Button>
            </Link>
          )}
          {isOpen && canAcknowledge && !expanding && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-slate-200 bg-white text-amber-700 hover:bg-amber-50 gap-1"
              onClick={onAcknowledge}
              disabled={acknowledging || resolving}
            >
              {acknowledging ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                  <span>Acknowledging...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Acknowledge</span>
                </>
              )}
            </Button>
          )}
          {(isOpen || isAcknowledged) && canResolve && !expanding && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 gap-1"
              onClick={onStartResolve}
              disabled={acknowledging || resolving}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolve</span>
            </Button>
          )}
        </div>
      </div>

      {/* Inline resolve form */}
      {expanding && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Resolution note (optional)</label>
          <Textarea
            rows={2}
            placeholder="What action was taken?"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelResolve} disabled={resolving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirmResolve}
              disabled={resolving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              {resolving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Resolving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Resolve</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
