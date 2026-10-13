import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Download,
  FileText,
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
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { getDevices, Device } from '../lib/api/devicesApi';
import { getSoftwareCatalog, SoftwareItem } from '../lib/api/softwareApi';
import { getAuditLogs, AuditLogItem } from '../lib/api/auditLogsApi';
import { getComplianceRollup } from '../lib/api/complianceApi';
import { listPatches } from '../lib/api/patchesApi';
import type { ComplianceDeviceRow } from '../types/compliance';
import type { PatchCoverage } from '../types/patch';

type ReportType = 'DEVICES' | 'SOFTWARE' | 'COMPLIANCE' | 'PATCHES' | 'ACTIVITY';

const REPORT_TITLES: Record<ReportType, string> = {
  DEVICES: 'Device Inventory Executive Report',
  SOFTWARE: 'Organizational Software Distribution Report',
  COMPLIANCE: 'Security Baseline Compliance Audit',
  PATCHES: 'Vulnerability & Patch Rollout Summary',
  ACTIVITY: 'System Activity & Audit Trail Report',
};

/** RFC-4180 field escaping: wrap in quotes when needed and double inner quotes. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [[...headers.map(csvCell)].join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n');
}

function downloadBlob(filename: string, mime: string, content: string | Blob) {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${mime};charset=utf-8` }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stampedName(prefix: string, ext: string): string {
  return `${prefix}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('DEVICES');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [software, setSoftware] = useState<SoftwareItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [complianceDevices, setComplianceDevices] = useState<ComplianceDeviceRow[]>([]);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [patches, setPatches] = useState<PatchCoverage[]>([]);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, swRes, auditRes, compRes, patchRes] = await Promise.all([
        getDevices({ limit: 500 }),
        getSoftwareCatalog({ limit: 500 }),
        getAuditLogs({ limit: 500 }),
        getComplianceRollup({ limit: 500 }).catch(() => null),
        listPatches({ limit: 500 }).catch(() => null),
      ]);

      if (devRes.success && devRes.data) {
        const raw = devRes.data as unknown;
        const dList = Array.isArray(raw)
          ? (raw as Device[])
          : ((raw as { items?: Device[]; devices?: Device[] }).items ??
            (raw as { devices?: Device[] }).devices ??
            []);
        setDevices(dList);
      }
      if (swRes.success && swRes.data) setSoftware(swRes.data.items || []);
      if (auditRes.success && auditRes.data) setAuditLogs(auditRes.data.items || []);
      if (compRes?.success && compRes.data) {
        setComplianceDevices(compRes.data.devices || []);
        setComplianceScore(typeof compRes.data.score === 'number' ? compRes.data.score : null);
      }
      if (patchRes?.success) setPatches(patchRes.data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  const tables = useMemo(() => {
    switch (activeTab) {
      case 'DEVICES':
        return {
          headers: ['Device Name', 'Hostname', 'Serial', 'OS', 'OS Version', 'IP Address', 'Status', 'Compliance', 'Last Seen'],
          rows: devices.map((d) => [
            d.deviceName, d.hostname, d.serialNumber ?? '', d.os, d.osVersion,
            d.ipAddress, d.status, (d as { complianceStatus?: string }).complianceStatus ?? '', d.lastSeenAt || 'Never',
          ]),
        };
      case 'SOFTWARE':
        return {
          headers: ['Application Name', 'Publisher', 'Latest Version', 'Installed Device Count'],
          rows: software.map((s) => [s.name, s.publisher, s.latestVersion, s.deviceCount]),
        };
      case 'COMPLIANCE':
        return {
          headers: ['Device', 'Hostname', 'OS', 'Compliance', 'Violations', 'Checks', 'Evaluated At'],
          rows: complianceDevices.map((c) => [
            c.deviceName, c.hostname, `${c.os} ${c.osVersion}`, c.status, c.violations, c.checks, c.evaluatedAt ?? 'Never',
          ]),
        };
      case 'PATCHES':
        return {
          headers: ['KB', 'Title', 'Severity', 'Status', 'Installed', 'Missing', 'Failed', 'Coverage Devices'],
          rows: patches.map((p) => [
            p.kbNumber, p.title, p.severity, p.status, p.installedCount, p.missingCount, p.failedCount, p.totalDevices,
          ]),
        };
      case 'ACTIVITY':
      default:
        return {
          headers: ['Timestamp', 'Actor', 'Action', 'Resource', 'Resource ID', 'IP Address'],
          rows: auditLogs.map((a) => [
            a.timestamp, a.actor?.email || a.actorId, a.action, a.resource, a.resourceId, a.ipAddress,
          ]),
        };
    }
  }, [activeTab, devices, software, complianceDevices, patches, auditLogs]);

  const handleExportCsv = () => {
    const { headers, rows } = tables;
    downloadBlob(stampedName(`Ricoz_${activeTab}_Report`, 'csv'), 'text/csv', toCsv(headers, rows));
  };

  const handleExportPdf = () => {
    setExporting(true);
    try {
      const { headers, rows } = tables;
      const title = REPORT_TITLES[activeTab];
      const generated = new Date().toLocaleString();
      const win = window.open('', '_blank', 'width=1000,height=700');
      if (!win) return;
      win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:32px;font-size:12px}
h1{font-size:20px;margin:0 0 4px} p.meta{color:#64748b;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f1f5f9} tr:nth-child(even) td{background:#f8fafc}
.footer{margin-top:16px;color:#64748b;font-size:10px}
@media print{.no-print{display:none}}
</style></head><body>
<h1>RicozEndpoint — ${escapeHtml(title)}</h1>
<p class="meta">Generated ${escapeHtml(generated)} · ${rows.length} record(s)${complianceScore !== null && activeTab === 'COMPLIANCE' ? ` · Fleet score ${complianceScore}%` : ''}</p>
<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${(r as unknown[]).map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody></table>
<p class="footer">RicozEndpoint compliance &amp; asset report — internal use.</p>
<div class="no-print" style="margin-top:16px"><button onclick="window.print()">Print / Save as PDF</button></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
      win.document.close();
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = [
    { label: 'Fleet Devices', value: devices.length, hint: `${devices.filter((d) => d.status === 'ONLINE').length} online` },
    { label: 'Software Titles', value: software.length, hint: `${software.reduce((a, s) => a + (s.deviceCount || 0), 0)} installs` },
    { label: 'Compliance Score', value: complianceScore !== null ? `${complianceScore}%` : '—', hint: `${complianceDevices.filter((c) => c.status === 'NON_COMPLIANT').length} non-compliant` },
    { label: 'Activity Records', value: auditLogs.length, hint: `${patches.length} patches tracked` },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        description="Generate, review, and export comprehensive endpoint asset, compliance, software and activity reports."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200 bg-white shadow-xs" onClick={() => void loadReportData()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExportCsv} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              {exporting ? 'Preparing…' : 'Export PDF'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-slate-200 bg-white shadow-xs">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        {(
          [
            { id: 'DEVICES', label: `Fleet Devices (${devices.length})`, icon: Laptop },
            { id: 'SOFTWARE', label: `Software Catalog (${software.length})`, icon: Package },
            { id: 'COMPLIANCE', label: 'Compliance Baseline', icon: ShieldCheck },
            { id: 'PATCHES', label: `Missing Patches (${patches.length})`, icon: Wrench },
            { id: 'ACTIVITY', label: `Audit Activity (${auditLogs.length})`, icon: History },
          ] as { id: ReportType; label: string; icon: typeof Laptop }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content View */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800">{REPORT_TITLES[activeTab]}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px]">{tables.rows.length} records</Badge>
            <span className="text-xs text-slate-500 hidden sm:inline">Live Backend Stream</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={8} columns={7} />
              <p className="pt-3 text-center text-xs text-slate-500">Generating report dataset...</p>
            </div>
          ) : tables.rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={BarChart3}
                title="No records for this report yet"
                description="Enroll devices and let agents report telemetry, then refresh."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                    {tables.headers.map((h) => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tables.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      {(row as unknown[]).map((cell, j) => (
                        <td
                          key={j}
                          className={`px-4 py-3 ${j === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'} ${typeof cell === 'string' && cell.length > 40 ? 'max-w-[280px] truncate' : ''}`}
                          title={String(cell ?? '')}
                        >
                          {String(cell ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {tables.rows.length > 200 && (
                <p className="p-3 text-[11px] text-slate-500 border-t border-slate-100">
                  Showing first 200 of {tables.rows.length} records — export CSV/PDF for the full dataset.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
