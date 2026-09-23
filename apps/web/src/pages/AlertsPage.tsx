import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, RefreshCw, Search, CheckCircle2, Server } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlertsList, useResolveAlert } from '../hooks/useAlerts';
import type { AlertItem, AlertSeverity, AlertStatus } from '../types/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { formatDateTime, formatRelativeTime } from '../lib/format';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

const inputClass =
  'w-full rounded-md bg-white border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50';

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
  return status === 'RESOLVED' ? 'success' : 'destructive';
}

export function AlertsPage() {
  const { hasRole } = useAuth();
  const canResolve = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const listQuery = useAlertsList({
    page: 1,
    limit: 50,
    status: statusFilter,
    severity: severityFilter,
    search: search || undefined,
  });
  const resolveMutation = useResolveAlert();

  const alerts = listQuery.data?.data?.items ?? [];
  const total = listQuery.data?.data?.total ?? 0;
  const openCount = alerts.filter((a) => a.status === 'OPEN').length;

  const handleResolve = (id: string) => {
    resolveMutation.mutate(
      { id, payload: { note: resolveNote.trim() || undefined } },
      {
        onSuccess: () => {
          setResolveTarget(null);
          setResolveNote('');
        },
      },
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Security &amp; Operational Alerts
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50">
              {total} matching
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time incident detection, severity classification, and administrator triage workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listQuery.isFetching && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
          <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open Alerts</span>
            <div className="text-2xl font-bold text-rose-600">{openCount}</div>
            <span className="text-[11px] text-slate-500">On current page</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Matching</span>
            <div className="text-2xl font-bold text-slate-900">{total}</div>
            <span className="text-[11px] text-slate-500">After filters</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Triage Access</span>
            <div className="text-sm font-bold text-slate-900">
              {canResolve ? 'Resolve enabled' : 'Read only'}
            </div>
            <span className="text-[11px] text-slate-500">
              {canResolve ? 'IT_ADMIN or above' : 'Requires IT_ADMIN role'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search alert titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${inputClass} w-auto`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')}
        >
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'ALL')}
        >
          <option value="ALL">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </div>

      {/* List */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-900 text-base">Alert Queue</CardTitle>
          <CardDescription>
            Compliance violations are raised automatically during heartbeat evaluation.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  canResolve={canResolve}
                  resolving={resolveMutation.isPending && resolveTarget === alert.id}
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
                  onConfirmResolve={() => handleResolve(alert.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {resolveMutation.isError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {(resolveMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  canResolve,
  resolving,
  expanding,
  note,
  onNoteChange,
  onStartResolve,
  onCancelResolve,
  onConfirmResolve,
}: {
  alert: AlertItem;
  canResolve: boolean;
  resolving: boolean;
  expanding: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onStartResolve: () => void;
  onCancelResolve: () => void;
  onConfirmResolve: () => void;
}) {
  const isOpen = alert.status === 'OPEN';

  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
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
            {alert.resolvedAt && (
              <>
                <span>•</span>
                <span className="text-emerald-600">Resolved {formatRelativeTime(alert.resolvedAt)}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {alert.device && (
            <Link to={`/devices/${alert.device.id}`}>
              <Button variant="outline" size="sm" className="h-7 text-[11px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                View Device
              </Button>
            </Link>
          )}
          {isOpen && canResolve && !expanding && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50"
              onClick={onStartResolve}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      {/* Inline resolve form */}
      {expanding && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <label className="text-xs font-medium text-slate-600">Resolution note (optional)</label>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="What action was taken?"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelResolve} disabled={resolving}>
              Cancel
            </Button>
            <Button size="sm" onClick={onConfirmResolve} disabled={resolving}>
              {resolving ? 'Resolving...' : 'Confirm Resolve'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}