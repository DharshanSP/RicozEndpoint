import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Eye,
  X,
  Download,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Pagination } from '../components/ui/Pagination';
import { getAuditLogs, auditLogsToCsv, AuditLogItem } from '../lib/api/auditLogsApi';

const ACTION_OPTIONS = [
  '',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'DEVICE_ENROLLED',
  'DEVICE_UPDATED',
  'DEVICE_DELETED',
  'COMMAND_CREATED',
  'COMMAND_CANCELLED',
  'PATCH_CREATED',
  'PATCH_UPDATED',
  'PATCH_DEPLOYED',
  'PATCH_RETRY',
  'PATCH_DELETED',
  'POLICY_CREATED',
  'POLICY_UPDATED',
  'POLICY_DELETED',
  'POLICY_ASSIGNED',
  'ALERT_ACKNOWLEDGED',
  'ALERT_RESOLVED',
  'USER_CREATED',
  'USER_UPDATED',
  'PASSWORD_CHANGED',
];

const RESOURCE_OPTIONS = ['', 'AUTH', 'DEVICE', 'COMMAND', 'PATCH', 'POLICY', 'ALERT', 'USER', 'ORGANIZATION', 'ENROLLMENT_TOKEN', 'GROUP', 'DEPLOYMENT'];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await getAuditLogs({
      page,
      limit: 25,
      search: debouncedSearch || undefined,
      action: actionFilter || undefined,
      resource: resourceFilter || undefined,
      from: from || undefined,
      to: to || undefined,
    });

    if (res.success && res.data) {
      setLogs(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [page, debouncedSearch, actionFilter, resourceFilter, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, resourceFilter, from, to]);

  const parseMetadata = (meta?: string | Record<string, unknown> | null) => {
    if (!meta) return null;
    if (typeof meta === 'object') return meta;
    try {
      return JSON.parse(meta);
    } catch {
      return meta;
    }
  };

  const handleExport = () => {
    const csv = auditLogsToCsv(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-page${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              System Audit Logs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable chronological audit record of logins, device activity, policy changes, patch operations, and privileged API requests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200 bg-white shadow-xs" onClick={handleExport} disabled={loading || logs.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200 bg-white shadow-xs" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            className="pl-9"
            placeholder="Search by actor email, resource ID, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Action filter"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          aria-label="Resource filter"
        >
          <option value="">All resources</option>
          {RESOURCE_OPTIONS.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      {/* Audit Log Table Card */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800">
            Audit Stream ({total} records)
          </CardTitle>
          <span className="text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <History className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No audit log records found</p>
              <p className="text-xs text-slate-500">Administrative actions will automatically be recorded here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor / Admin</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target Resource</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {log.actor?.email || (log.actorId ? log.actorId.slice(0, 8) : 'system')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium font-mono" title={log.resourceId}>
                        {log.resource} ({log.resourceId.slice(0, 8)})
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="text-slate-600 hover:text-blue-600 px-2.5 py-1 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / 25))}
        totalItems={total}
        pageSize={25}
        onPageChange={setPage}
        itemLabel="records"
      />

      {/* Modal: View Log Payload */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Audit Log Detail
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Action:</span>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Actor:</span>
                  <p className="font-semibold text-slate-900 mt-0.5 break-all">{selectedLog.actor?.email || selectedLog.actorId || 'system'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Resource:</span>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedLog.resource}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Resource ID:</span>
                  <p className="font-mono text-slate-900 mt-0.5 break-all">{selectedLog.resourceId}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Timestamp:</span>
                  <p className="font-mono text-slate-900 mt-0.5">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">IP address:</span>
                  <p className="font-mono text-slate-900 mt-0.5">{selectedLog.ipAddress || '—'}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Metadata JSON
                </label>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(parseMetadata(selectedLog.metadata), null, 2) || '{}'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button size="sm" className="h-9 text-xs px-4" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
