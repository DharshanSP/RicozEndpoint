import { useState } from 'react';
import {
  Wrench,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  Search,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface PatchItem {
  id: string;
  kbNumber: string;
  title: string;
  severity: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';
  category: string;
  affectedDevices: number;
  releaseDate: string;
  status: 'PENDING' | 'APPROVED' | 'DEPLOYED';
}

const MOCK_PATCHES: PatchItem[] = [
  {
    id: 'patch-1',
    kbNumber: 'KB5034441',
    title: 'Windows 11 Security Update for WinRE & BitLocker Vulnerability',
    severity: 'CRITICAL',
    category: 'Security Update',
    affectedDevices: 8,
    releaseDate: '2026-02-12',
    status: 'PENDING',
  },
  {
    id: 'patch-2',
    kbNumber: 'KB5034765',
    title: 'Cumulative Security Update for Windows 11 Version 23H2 (x64)',
    severity: 'CRITICAL',
    category: 'Cumulative Update',
    affectedDevices: 12,
    releaseDate: '2026-02-20',
    status: 'APPROVED',
  },
  {
    id: 'patch-3',
    kbNumber: 'KB5034204',
    title: 'Microsoft Defender Antivirus Security Intelligence Update v1.405.x',
    severity: 'IMPORTANT',
    category: 'Definition Update',
    affectedDevices: 5,
    releaseDate: '2026-03-01',
    status: 'DEPLOYED',
  },
  {
    id: 'patch-4',
    kbNumber: 'KB5034123',
    title: '.NET Framework 4.8.1 Security & Quality Rollup for Windows 10/11',
    severity: 'OPTIONAL',
    category: 'Framework Update',
    affectedDevices: 14,
    releaseDate: '2026-01-15',
    status: 'PENDING',
  },
];

export function PatchesPage() {
  const [patches, setPatches] = useState<PatchItem[]>(MOCK_PATCHES);
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      alert('Vulnerability & Patch scan initiated across all active agent endpoints.');
    }, 1200);
  };

  const handleApprove = (id: string) => {
    setPatches((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'APPROVED' } : p))
    );
  };

  const handleDeploy = (id: string) => {
    setPatches((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'DEPLOYED' } : p))
    );
    alert('Patch deployment queued! Agents will pull and install on next maintenance heartbeat.');
  };

  const criticalCount = patches.filter((p) => p.severity === 'CRITICAL').length;
  const importantCount = patches.filter((p) => p.severity === 'IMPORTANT').length;
  const optionalCount = patches.filter((p) => p.severity === 'OPTIONAL').length;

  const filteredPatches = patches.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.kbNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Patch Management
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Scan CVE vulnerabilities, review OS update rings, approve critical KB updates, and track deployment status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning endpoints...' : 'Run Fleet Patch Scan'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Critical Patches
              </p>
              <h3 className="text-2xl font-bold text-red-900 mt-0.5">{criticalCount}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-red-100 text-red-700">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Important
              </p>
              <h3 className="text-2xl font-bold text-amber-900 mt-0.5">{importantCount}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Optional
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{optionalCount}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
              <Wrench className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Up-To-Date Fleet
              </p>
              <h3 className="text-2xl font-bold text-emerald-900 mt-0.5">86%</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by KB number or update title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* Patch List */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            Pending & Available Software Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filteredPatches.map((patch) => (
              <div key={patch.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-800">
                      {patch.kbNumber}
                    </Badge>

                    {patch.severity === 'CRITICAL' ? (
                      <Badge variant="destructive" className="text-[10px]">
                        CRITICAL
                      </Badge>
                    ) : patch.severity === 'IMPORTANT' ? (
                      <Badge variant="warning" className="text-[10px]">
                        IMPORTANT
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        OPTIONAL
                      </Badge>
                    )}

                    <span className="text-xs text-slate-400">• Released {patch.releaseDate}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900">{patch.title}</h4>
                  <p className="text-xs text-slate-500">
                    Category: {patch.category} • Target devices requiring update: {patch.affectedDevices} machines
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {patch.status === 'PENDING' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(patch.id)}
                      className="text-blue-600 hover:bg-blue-50 border-blue-200"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  ) : patch.status === 'APPROVED' ? (
                    <Button
                      size="sm"
                      onClick={() => handleDeploy(patch.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Deploy Now
                    </Button>
                  ) : (
                    <Badge variant="success" className="text-xs py-1 px-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Deployed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
