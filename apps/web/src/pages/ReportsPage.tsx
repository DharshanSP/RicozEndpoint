import { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Laptop,
  Package,
  ShieldCheck,
  Wrench,
  History,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { getDevices, Device } from '../lib/api/devicesApi';
import { getSoftwareCatalog, SoftwareItem } from '../lib/api/softwareApi';
import { getAuditLogs, AuditLogItem } from '../lib/api/auditLogsApi';

type ReportType = 'DEVICES' | 'SOFTWARE' | 'COMPLIANCE' | 'PATCHES' | 'AUDIT';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('DEVICES');
  const [loading, setLoading] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [software, setSoftware] = useState<SoftwareItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const loadReportData = async () => {
    setLoading(true);
    const [devRes, swRes, auditRes] = await Promise.all([
      getDevices({ limit: 100 }),
      getSoftwareCatalog({ limit: 100 }),
      getAuditLogs({ limit: 100 }),
    ]);

    if (devRes.success && devRes.data) {
      const dList = Array.isArray(devRes.data) ? devRes.data : (devRes.data as any).items || [];
      setDevices(dList);
    }
    if (swRes.success && swRes.data) setSoftware(swRes.data.items || []);
    if (auditRes.success && auditRes.data) setAuditLogs(auditRes.data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCsv = () => {
    if (activeTab === 'DEVICES') {
      const headers = ['Device Name', 'Hostname', 'OS', 'OS Version', 'IP Address', 'Status', 'Last Seen'];
      const rows = devices.map((d) => [
        `"${d.deviceName}"`,
        `"${d.hostname}"`,
        `"${d.os}"`,
        `"${d.osVersion}"`,
        `"${d.ipAddress}"`,
        `"${d.status}"`,
        `"${d.lastSeenAt || 'Never'}"`,
      ]);
      downloadCsv('Ricoz_Device_Report', [headers, ...rows]);
    } else if (activeTab === 'SOFTWARE') {
      const headers = ['Application Name', 'Publisher', 'Latest Version', 'Installed Machine Count'];
      const rows = software.map((s) => [
        `"${s.name}"`,
        `"${s.publisher}"`,
        `"${s.latestVersion}"`,
        `"${s.deviceCount}"`,
      ]);
      downloadCsv('Ricoz_Software_Inventory_Report', [headers, ...rows]);
    } else if (activeTab === 'AUDIT') {
      const headers = ['Timestamp', 'Actor', 'Action', 'Resource', 'Resource ID', 'IP Address'];
      const rows = auditLogs.map((a) => [
        `"${a.timestamp}"`,
        `"${a.actor?.email || a.actorId}"`,
        `"${a.action}"`,
        `"${a.resource}"`,
        `"${a.resourceId}"`,
        `"${a.ipAddress}"`,
      ]);
      downloadCsv('Ricoz_Audit_Logs_Report', [headers, ...rows]);
    } else {
      alert('Generating report package...');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports & Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Generate, review, and export comprehensive enterprise endpoint asset, compliance, and audit reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadReportData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('DEVICES')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'DEVICES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Laptop className="w-4 h-4" />
          Fleet Devices ({devices.length})
        </button>

        <button
          onClick={() => setActiveTab('SOFTWARE')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'SOFTWARE'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          Software Catalog ({software.length})
        </button>

        <button
          onClick={() => setActiveTab('COMPLIANCE')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'COMPLIANCE'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Compliance Baseline
        </button>

        <button
          onClick={() => setActiveTab('PATCHES')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'PATCHES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Missing Patches
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'AUDIT'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Activity ({auditLogs.length})
        </button>
      </div>

      {/* Content View */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800">
            {activeTab === 'DEVICES' && 'Device Inventory Executive Report'}
            {activeTab === 'SOFTWARE' && 'Organizational Software Distribution Report'}
            {activeTab === 'COMPLIANCE' && 'Security Baseline Compliance Audit'}
            {activeTab === 'PATCHES' && 'Vulnerability & Patch Rollout Summary'}
            {activeTab === 'AUDIT' && 'System Audit Trail Report'}
          </CardTitle>
          <span className="text-xs text-slate-500">Live Backend Stream</span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Generating report dataset...
            </div>
          ) : activeTab === 'DEVICES' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Device</th>
                    <th className="p-3">OS</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Agent Version</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{d.deviceName}</td>
                      <td className="p-3 text-slate-600">{d.os} ({d.osVersion})</td>
                      <td className="p-3 font-mono text-slate-600">{d.ipAddress || '127.0.0.1'}</td>
                      <td className="p-3 text-slate-600">{d.agentVersion || 'v1.0.0'}</td>
                      <td className="p-3">
                        <Badge variant={d.status === 'ONLINE' ? 'success' : 'secondary'} className="text-[10px]">
                          {d.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'SOFTWARE' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Application</th>
                    <th className="p-3">Publisher</th>
                    <th className="p-3">Latest Version</th>
                    <th className="p-3">Installed Fleet Devices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {software.map((s) => (
                    <tr key={s.name} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="p-3 text-slate-600">{s.publisher}</td>
                      <td className="p-3 font-mono text-slate-600">v{s.latestVersion}</td>
                      <td className="p-3 font-bold text-slate-800">{s.deviceCount} machines</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'AUDIT' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Resource</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500 font-mono">{a.timestamp}</td>
                      <td className="p-3 font-semibold text-slate-900">{a.actor?.email || a.actorId}</td>
                      <td className="p-3 font-mono text-blue-600 font-semibold">{a.action}</td>
                      <td className="p-3 text-slate-700">{a.resource} ({a.resourceId.slice(0, 8)})</td>
                      <td className="p-3 font-mono text-slate-500">{a.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Previewing baseline compliance telemetry report dataset...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
