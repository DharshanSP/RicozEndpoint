import { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { getAuditLogs, AuditLogItem } from '../lib/api/auditLogsApi';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const res = await getAuditLogs({
      page,
      limit: 25,
      search,
      action: actionFilter || undefined,
    });

    if (res.success && res.data) {
      setLogs(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [page, search, actionFilter]);

  const parseMetadata = (meta?: string | null) => {
    if (!meta) return null;
    try {
      return JSON.parse(meta);
    } catch {
      return meta;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              System Audit Logs
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immutable chronological audit record of administrator operations, policy modifications, enrollment events, and privileged API requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Action Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by actor email, resource ID, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Action Types</option>
            <option value="LOGIN">LOGIN</option>
            <option value="POLICY">POLICY</option>
            <option value="COMMAND">COMMAND</option>
            <option value="ENROLLMENT">ENROLLMENT</option>
            <option value="GROUP">GROUP</option>
            <option value="SETTINGS">SETTINGS</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table Card */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
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
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor / Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Resource</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {log.actor?.email || log.actorId}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {log.resource} ({log.resourceId.slice(0, 8)})
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="text-slate-600 hover:text-blue-600 px-2 py-1 text-xs"
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
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-slate-500 font-medium">
          Page {page} of {Math.max(1, Math.ceil(total / 25))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      {/* Modal: View Log Payload */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
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
                  <p className="font-semibold text-slate-900 mt-0.5">{selectedLog.actor?.email || selectedLog.actorId}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Resource:</span>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedLog.resource}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Resource ID:</span>
                  <p className="font-mono text-slate-900 mt-0.5">{selectedLog.resourceId}</p>
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
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
