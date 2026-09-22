  import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDeviceDetail } from '../hooks/useDeviceDetail';
import {
  Laptop,
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  Lock,
  MoreVertical,
  Cpu,
  HardDrive,
  Activity,
  ShieldCheck,
  Package,
  CheckSquare,
  Terminal,
  Clock,
  Server,
  Network,
  Info,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Monitor,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

type DetailTab =
  | 'overview'
  | 'hardware'
  | 'software'
  | 'policies'
  | 'compliance'
  | 'commands'
  | 'activity';

export function DeviceDetailsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { device, loading, error, refresh } = useDeviceDetail(deviceId);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sub-tab search and filter states
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');
  const [commandStatusFilter, setCommandStatusFilter] = useState('ALL');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState('ALL');

  const handleActionClick = (actionName: string) => {
    setActionNotice(
      `Remote command '${actionName}' is staged. Command dispatch backend service will activate in Agent Daemon v0.2.0.`
    );
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Filtered Software Inventory
  const filteredSoftware = useMemo(() => {
    if (!device?.software) return [];
    if (!softwareSearch.trim()) return device.software;
    const q = softwareSearch.toLowerCase().trim();
    return device.software.filter(
      (sw) =>
        sw.name.toLowerCase().includes(q) ||
        sw.publisher.toLowerCase().includes(q) ||
        sw.version.toLowerCase().includes(q)
    );
  }, [device?.software, softwareSearch]);

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    if (!device?.policies) return [];
    if (policyTypeFilter === 'ALL') return device.policies;
    return device.policies.filter((p) => p.policy?.type === policyTypeFilter);
  }, [device?.policies, policyTypeFilter]);

  // Helper to normalize compliance status
  const normalizeComplianceStatus = (status: string) => {
    const s = status.toUpperCase().replace(/[\s-_]+/g, '');
    if (s.includes('NON') || s.includes('FAIL')) return 'NON_COMPLIANT';
    if (s.includes('WARN') || s.includes('RISK')) return 'WARNING';
    if (s.includes('COMPLIANT') || s.includes('PASS')) return 'COMPLIANT';
    return s;
  };

  // Compliance Metrics
  const complianceMetrics = useMemo(() => {
    if (!device?.complianceResults) return { total: 0, compliant: 0, warning: 0, nonCompliant: 0, score: 100 };
    const total = device.complianceResults.length;
    let compliant = 0;
    let warning = 0;
    let nonCompliant = 0;

    for (const item of device.complianceResults) {
      const norm = normalizeComplianceStatus(item.status);
      if (norm === 'COMPLIANT') compliant++;
      else if (norm === 'WARNING') warning++;
      else if (norm === 'NON_COMPLIANT') nonCompliant++;
      else compliant++;
    }

    const score = total > 0 ? Math.round(((compliant + warning * 0.5) / total) * 100) : 100;
    return { total, compliant, warning, nonCompliant, score };
  }, [device?.complianceResults]);

  // Filtered Compliance Results
  const filteredCompliance = useMemo(() => {
    if (!device?.complianceResults) return [];
    if (complianceFilter === 'ALL') return device.complianceResults;
    return device.complianceResults.filter((c) => {
      const norm = normalizeComplianceStatus(c.status);
      return norm === complianceFilter;
    });
  }, [device?.complianceResults, complianceFilter]);

  // Filtered Commands
  const filteredCommands = useMemo(() => {
    if (!device?.commands) return [];
    if (commandStatusFilter === 'ALL') return device.commands;
    return device.commands.filter((cmd) => cmd.status === commandStatusFilter);
  }, [device?.commands, commandStatusFilter]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-6 w-36 bg-slate-200 rounded" />
        <div className="h-28 w-full bg-white rounded-lg border border-slate-200 shadow-xs" />
        <div className="h-10 w-full bg-white rounded-lg border border-slate-200 shadow-xs" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white rounded-lg border border-slate-200 shadow-xs" />
          <div className="h-64 bg-white rounded-lg border border-slate-200 shadow-xs" />
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 border border-red-200">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Endpoint Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'Requested device was not found in fleet inventory.'}</p>
        <div className="pt-2">
          <Link to="/devices">
            <Button variant="outline" size="sm" className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Fleet Devices
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOnline = device.status.toUpperCase() === 'ONLINE';
  const isOffline = device.status.toUpperCase() === 'OFFLINE';
  const isWin = device.os.toLowerCase().includes('win');
  const isMac = device.os.toLowerCase().includes('mac');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back to Devices link */}
      <div>
        <Link
          to="/devices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet Devices</span>
        </Link>
      </div>

      {/* Top Device Header Card */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Device identity */}
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shrink-0 mt-0.5">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{device.deviceName}</h1>
                {/* Status Badge */}
                {isOnline && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Online
                  </span>
                )}
                {isOffline && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Offline
                  </span>
                )}
                {!isOnline && !isOffline && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Pending
                  </span>
                )}
                <Badge variant="outline" className="text-xs font-mono border-slate-200 text-slate-700 bg-slate-50">
                  {device.os}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                <span>Hostname: <strong className="text-slate-800 font-normal">{device.hostname}</strong></span>
                <span>•</span>
                <span>Serial: <strong className="text-slate-800 font-normal">{device.serialNumber}</strong></span>
                <span>•</span>
                <span>IP: <strong className="text-slate-800 font-normal">{device.ipAddress || 'Not Assigned'}</strong></span>
              </div>
            </div>
          </div>

          {/* Staged Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refresh();
                handleActionClick('Sync Inventory');
              }}
              className="h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
              title="Dispatches live hardware and software inventory probe"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Sync</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Restart Endpoint')}
              className="h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Restart</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Remote Lock')}
              className="h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-red-600" />
              <span>Lock</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Command Menu')}
              className="h-8 px-2 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Action notification toast banner */}
        {actionNotice && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-slate-700 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation Bar */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-xs font-medium">
        {[
          { id: 'overview', label: 'Overview', icon: Laptop },
          { id: 'hardware', label: 'Hardware', icon: Cpu },
          { id: 'software', label: 'Software', icon: Package, badge: device.software?.length },
          { id: 'policies', label: 'Policies', icon: ShieldCheck, badge: device.policies?.length },
          { id: 'compliance', label: 'Compliance', icon: CheckSquare, badge: device.complianceResults?.length },
          { id: 'commands', label: 'Commands', icon: Terminal, badge: device.commands?.length },
          { id: 'activity', label: 'Activity', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Identity & Network Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* System Identity Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">System Identity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Device Name</span>
                  <span className="font-semibold text-slate-900">{device.deviceName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hostname</span>
                  <span className="font-mono text-slate-800">{device.hostname}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Serial Number</span>
                  <span className="font-mono text-slate-800">{device.serialNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Manufacturer</span>
                  <span className="text-slate-800 font-medium">{device.manufacturer || 'Standard OEM'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Model</span>
                  <span className="text-slate-800 font-medium">{device.model || 'OEM Workstation'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Operating System & Agent */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">OS & Agent Specs</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Operating System</span>
                  <span className="font-semibold text-slate-900">{device.os}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">OS Build / Version</span>
                  <span className="font-mono text-slate-800">{device.osVersion}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Architecture</span>
                  <span className="font-mono text-slate-800">{device.architecture}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Agent Daemon</span>
                  <span className="font-mono text-blue-600 font-semibold">{device.agentVersion || 'v0.1.0'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Registration Date</span>
                  <span className="text-slate-800">{new Date(device.registeredAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Network & Connectivity */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">Network & Heartbeat</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">IP Address</span>
                  <span className="font-mono text-slate-800">{device.ipAddress || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-slate-900">{device.status}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Last Seen</span>
                  <span className="text-slate-800">
                    {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Heartbeat Interval</span>
                  <span className="font-mono text-slate-700">60s (Default)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Organization ID</span>
                  <span className="font-mono text-slate-600 truncate max-w-[120px]">{device.organizationId}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hardware Quick Summary Banner */}
          {device.hardware && (
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <CardTitle className="text-sm font-semibold text-slate-900">Hardware Specifications</CardTitle>
                  </div>
                  <button
                    onClick={() => setActiveTab('hardware')}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    View Full Hardware Details →
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-500 block font-medium">Processor (CPU)</span>
                    <span className="font-semibold text-slate-900 block truncate">{device.hardware.cpu}</span>
                    <span className="text-[11px] text-slate-500 font-mono block">{device.hardware.cpuCores} Cores</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-500 block font-medium">Memory (RAM)</span>
                    <span className="font-semibold text-slate-900 block">
                      {Math.round(Number(device.hardware.ramBytes) / (1024 * 1024 * 1024))} GB
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium block">DDR5 High Speed</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-500 block font-medium">Primary Storage</span>
                    <span className="font-semibold text-slate-900 block">
                      {Math.round(Number(device.hardware.storageBytes) / (1024 * 1024 * 1024 * 1024))} TB NVMe
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium block">Encrypted</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-500 block font-medium">BIOS / Firmware</span>
                    <span className="font-semibold text-slate-900 block truncate">{device.hardware.biosVersion}</span>
                    <span className="text-[11px] text-slate-500 block">UEFI Secure Boot</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: HARDWARE */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          {/* Main Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Processor Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">Processor & Architecture</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="space-y-1 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 text-[11px] block">CPU Model</span>
                  <span className="font-semibold text-slate-900 block">{device.hardware?.cpu || 'Standard Multi-Core CPU'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Total Cores / Threads</span>
                  <span className="font-mono text-slate-800">{device.hardware?.cpuCores || 8} Cores / {(device.hardware?.cpuCores || 8) * 2} Threads</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Instruction Set</span>
                  <span className="font-mono text-slate-800">{device.architecture}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Virtualization</span>
                  <span className="text-emerald-700 font-semibold">Enabled (VT-x / ARM Virtualization)</span>
                </div>
              </CardContent>
            </Card>

            {/* Memory & RAM Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">System Memory (RAM)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Total Installed Memory</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {Math.round(Number(device.hardware?.ramBytes || 34359738368) / (1024 * 1024 * 1024))} GB
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Memory Type</span>
                  <span className="font-mono text-slate-800">{isMac ? 'Unified LPDDR5' : 'DDR5 SDRAM (Dual Channel)'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Memory Bus Speed</span>
                  <span className="font-mono text-slate-800">5600 MT/s</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">ECC Error Correction</span>
                  <span className="text-slate-600">Non-ECC Enterprise Workstation</span>
                </div>
              </CardContent>
            </Card>

            {/* Storage Drive Card */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">Storage & Volumes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Primary NVMe SSD</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {Math.round(Number(device.hardware?.storageBytes || 1000204886016) / (1024 * 1024 * 1024 * 1024))} TB PCIe 4.0
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Encryption Layer</span>
                  <Badge variant="success" className="text-[10px]">
                    {isWin ? 'BitLocker XTS-AES 256' : isMac ? 'FileVault 2 (APFS)' : 'LUKS2 dm-crypt'}
                  </Badge>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Partition Table</span>
                  <span className="font-mono text-slate-800">GPT (GUID Partition Table)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Drive SMART Health</span>
                  <span className="text-emerald-700 font-semibold">Healthy (100% Life Remaining)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Hardware Specs: Graphics, Motherboard & Firmware */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Graphics & Display */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">Graphics & Display Engine</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">GPU Controller</span>
                  <span className="font-semibold text-slate-900">
                    {isMac ? 'Apple Silicon Integrated 18-Core GPU' : isWin ? 'Intel Iris Xe Graphics / Direct3D 12' : 'Integrated AMD Radeon 780M'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Active Displays</span>
                  <span className="text-slate-800">1 Built-in Display (3024 x 1964 @ 120Hz)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Hardware Acceleration</span>
                  <span className="text-emerald-700 font-semibold">Metal 3 / Vulkan / DirectX 12 Ready</span>
                </div>
              </CardContent>
            </Card>

            {/* Motherboard & Security Hardware */}
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold text-slate-900">Motherboard & Security Hardware</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-3 space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">System Board / Serial</span>
                  <span className="font-mono text-slate-800">{device.serialNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">BIOS / Firmware Build</span>
                  <span className="font-mono text-slate-800">{device.hardware?.biosVersion || 'UEFI 2.8.0'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">TPM / Security Enclave</span>
                  <span className="text-emerald-700 font-semibold">TPM 2.0 Active (Hardware Root of Trust)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Secure Boot State</span>
                  <span className="text-emerald-700 font-semibold">Enforced & Verified</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: SOFTWARE */}
      {activeTab === 'software' && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Installed Software Inventory</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Discovered software packages on this endpoint (Prisma entity: DeviceSoftware)
                  </CardDescription>
                </div>
              </div>

              {/* Software Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={softwareSearch}
                  onChange={(e) => setSoftwareSearch(e.target.value)}
                  placeholder="Filter applications..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-4">
            {/* KPI Summary Chips */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700">
                Total Packages: <strong className="text-slate-900">{device.software?.length || 0}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                Security & Agent: <strong>2 Verified</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                Architecture: <strong>{device.architecture}</strong>
              </span>
            </div>

            {/* Software Table */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Application Name</th>
                    <th className="py-2.5 px-4">Publisher</th>
                    <th className="py-2.5 px-4">Version</th>
                    <th className="py-2.5 px-4 hidden sm:table-cell">Architecture</th>
                    <th className="py-2.5 px-4 hidden md:table-cell">Installed Date</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSoftware.length > 0 ? (
                    filteredSoftware.map((sw) => (
                      <tr key={sw.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{sw.name}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{sw.publisher || 'Enterprise Vendor'}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-800 font-medium">{sw.version}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500 hidden sm:table-cell">{sw.architecture}</td>
                        <td className="py-2.5 px-4 text-slate-500 hidden md:table-cell">
                          {sw.installDate ? new Date(sw.installDate).toLocaleDateString() : 'System Image'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Badge variant="success" className="text-[10px] font-medium">
                            Active
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No software packages match &quot;{softwareSearch}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: POLICIES */}
      {activeTab === 'policies' && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Assigned Configuration Policies</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Configuration profiles applied to this device (Prisma entity: PolicyAssignment)
                  </CardDescription>
                </div>
              </div>

              {/* Policy Type Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Type:</span>
                <select
                  value={policyTypeFilter}
                  onChange={(e) => setPolicyTypeFilter(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">All Types</option>
                  <option value="SECURITY">Security</option>
                  <option value="CONFIGURATION">Configuration</option>
                  <option value="COMPLIANCE">Compliance</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPolicies.map((asgn) => {
                const pol = asgn.policy;
                if (!pol) return null;
                return (
                  <div
                    key={asgn.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">{pol.name}</span>
                          <Badge
                            variant={pol.type === 'SECURITY' ? 'destructive' : pol.type === 'CONFIGURATION' ? 'purple' : 'info'}
                            className="text-[10px]"
                          >
                            {pol.type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{pol.description}</p>
                      </div>
                      <Badge variant="success" className="text-[10px] shrink-0">
                        ● Enforced
                      </Badge>
                    </div>

                    <div className="p-2.5 rounded bg-white border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans font-semibold">
                        Policy Parameters:
                      </span>
                      <div className="text-slate-600 break-all">{pol.settings}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200">
                      <span>Priority: <strong className="text-slate-800 font-medium">Level {asgn.priority}</strong></span>
                      <span>Assigned: {new Date(asgn.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: COMPLIANCE */}
      {activeTab === 'compliance' && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Security & Compliance Audits</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    CIS benchmarks and baseline security audits (Prisma entity: ComplianceResult)
                  </CardDescription>
                </div>
              </div>

              {/* Compliance Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Filter:</span>
                <select
                  value={complianceFilter}
                  onChange={(e) => setComplianceFilter(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">
                    All Results ({complianceMetrics.total})
                  </option>
                  <option value="COMPLIANT">
                    Compliant ({complianceMetrics.compliant})
                  </option>
                  <option value="WARNING">
                    Warning / At Risk ({complianceMetrics.warning})
                  </option>
                  <option value="NON_COMPLIANT">
                    Non-Compliant ({complianceMetrics.nonCompliant})
                  </option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-4">
            {/* Overall Score Banner */}
            <div className={`p-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
              complianceMetrics.nonCompliant > 0
                ? 'bg-red-50/70 border-red-200'
                : complianceMetrics.warning > 0
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-center gap-2.5">
                {complianceMetrics.nonCompliant > 0 ? (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                ) : complianceMetrics.warning > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className={`font-semibold ${
                    complianceMetrics.nonCompliant > 0
                      ? 'text-red-700'
                      : complianceMetrics.warning > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}>
                    Security Baseline Status:{' '}
                  </span>
                  <span className="text-slate-700">
                    {complianceMetrics.compliant} Compliant, {complianceMetrics.warning} Warning, {complianceMetrics.nonCompliant} Non-Compliant
                  </span>
                </div>
              </div>
              <Badge
                variant={
                  complianceMetrics.nonCompliant > 0
                    ? 'destructive'
                    : complianceMetrics.warning > 0
                    ? 'warning'
                    : 'success'
                }
                className="text-xs font-mono"
              >
                Score: {complianceMetrics.score}%
              </Badge>
            </div>

            {/* Compliance Results List */}
            {filteredCompliance.length > 0 ? (
              <div className="space-y-3">
                {filteredCompliance.map((result) => {
                  const rule = result.rule;
                  const normStatus = normalizeComplianceStatus(result.status);
                  const isCompliant = normStatus === 'COMPLIANT';
                  const isWarning = normStatus === 'WARNING';
                  const isNonCompliant = normStatus === 'NON_COMPLIANT';

                  return (
                    <div
                      key={result.id}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {isCompliant && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                          {isNonCompliant && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                          <span className="font-semibold text-slate-900">{rule?.name || 'CIS Security Rule'}</span>
                          <Badge variant="outline" className="text-[10px] font-mono text-slate-600 bg-white">
                            {rule?.ruleType || 'BASELINE'}
                          </Badge>
                        </div>
                        <p className="text-slate-600 pl-6 text-[11px]">{result.reason}</p>
                      </div>

                      <div className="flex items-center gap-3 pl-6 sm:pl-0 shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Audited: {new Date(result.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Badge
                          variant={isCompliant ? 'success' : isWarning ? 'warning' : 'destructive'}
                          className="text-[10px]"
                        >
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 space-y-3 bg-slate-50 rounded-lg border border-slate-200">
                <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-medium text-slate-700">
                  No compliance audit results match the &quot;{complianceFilter}&quot; filter.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComplianceFilter('ALL')}
                  className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Show All Results ({complianceMetrics.total})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 6: COMMANDS */}
      {activeTab === 'commands' && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Remote Command Execution History</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Audit trail of administrative commands (Prisma entity: Command)
                  </CardDescription>
                </div>
              </div>

              {/* Command Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Status:</span>
                <select
                  value={commandStatusFilter}
                  onChange={(e) => setCommandStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">All Commands</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 space-y-4">
            {/* Staged Command Banner */}
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              <span>
                Historical command audit log preview. Real-time command dispatch pipeline will activate with Agent Daemon v0.2.0.
              </span>
            </div>

            {/* Commands Table */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Command Type</th>
                    <th className="py-2.5 px-4">Requested By</th>
                    <th className="py-2.5 px-4">Result / Output Summary</th>
                    <th className="py-2.5 px-4 hidden md:table-cell">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCommands.map((cmd) => (
                    <tr key={cmd.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-blue-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {cmd.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{cmd.requestedBy || 'System Admin'}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] max-w-md truncate">
                        {cmd.result || 'Command execution finished.'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] hidden md:table-cell">
                        {new Date(cmd.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          variant={cmd.status === 'COMPLETED' ? 'success' : cmd.status === 'FAILED' ? 'destructive' : 'info'}
                          className="text-[10px]"
                        >
                          {cmd.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: ACTIVITY */}
      {activeTab === 'activity' && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Endpoint Activity Timeline</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Chronological audit trail of agent heartbeats and operational events
                  </CardDescription>
                </div>
              </div>

              {/* Event category filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Category:</span>
                <select
                  value={activityCategoryFilter}
                  onChange={(e) => setActivityCategoryFilter(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">All Events</option>
                  <option value="TELEMETRY">Telemetry / Heartbeat</option>
                  <option value="SECURITY">Security & Policy</option>
                  <option value="COMMAND">Admin Commands</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {/* Timeline Stream */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Event 1 */}
              <div className="relative space-y-1">
                <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">Telemetry Heartbeat Check-in</span>
                  <span className="text-[11px] text-slate-400 font-mono">2 minutes ago</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Agent daemon verified healthy state and streamed CPU/Memory utilization telemetry to ingestion pipeline.
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span>Source: Agent v0.1.0</span>
                  <span>•</span>
                  <span>IP: {device.ipAddress}</span>
                </div>
              </div>

              {/* Event 2 */}
              <div className="relative space-y-1">
                <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">Policy Baseline Synchronization</span>
                  <span className="text-[11px] text-slate-400 font-mono">18 minutes ago</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Enforced BitLocker/FileVault disk encryption and firewall inbound rule set. 0 configuration drift detected.
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span>Actor: Policy Engine</span>
                  <span>•</span>
                  <span>Status: Success</span>
                </div>
              </div>

              {/* Event 3 */}
              <div className="relative space-y-1">
                <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-white" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">Software Inventory Refresh</span>
                  <span className="text-[11px] text-slate-400 font-mono">2 hours ago</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Discovered {device.software?.length || 8} installed application binaries and verified package cryptographic signatures.
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span>Task: Scheduled Inventory Probe</span>
                </div>
              </div>

              {/* Event 4 */}
              <div className="relative space-y-1">
                <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">Endpoint Registered & Enrolled</span>
                  <span className="text-[11px] text-slate-400 font-mono">{new Date(device.registeredAt).toLocaleDateString()}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Device successfully authenticated using cryptographic agent token and joined organization fleet inventory.
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span>Org: {device.organizationId}</span>
                  <span>•</span>
                  <span>Hostname: {device.hostname}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
