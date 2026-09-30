import { useState, useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Root as TabsRoot, List as TabsList, Trigger as TabsTrigger, Content as TabsContent } from '@radix-ui/react-tabs';
import {
  ChevronRight,
  Activity,
  CheckSquare,
  Clock,
  Cpu,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Lock,
  RotateCcw,
  Power,
  Search,
  CheckCircle2,
  Copy,
  Check,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useDeviceActivity, useDeviceDetail, useDeviceHardware, useDeviceSoftware } from '../hooks/useDeviceQueries';
import { formatBytes, formatDateTime, formatRelativeTime } from '../lib/format';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ErrorState } from '../components/ErrorState';
import type {
  ActivityEvent,
  ActivityType,
  AssignedPolicy,
  CommandRecord,
  ComplianceResult,
  DeviceComplianceStatus,
  DeviceSoftwareItem,
  DeviceStatus,
} from '../types/device';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'policies', label: 'Policies' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'commands', label: 'Commands' },
  { value: 'activity', label: 'Activity' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function statusBadgeVariant(status: DeviceStatus): BadgeVariant {
  switch (status) {
    case 'ONLINE':
      return 'success';
    case 'OFFLINE':
      return 'destructive';
    case 'PENDING':
      return 'warning';
    case 'NON_COMPLIANT':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function complianceBadgeVariant(status: DeviceComplianceStatus): BadgeVariant {
  switch (status) {
    case 'COMPLIANT':
      return 'success';
    case 'NON_COMPLIANT':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function checkBadgeVariant(status: string): BadgeVariant {
  if (status === 'COMPLIANT') return 'success';
  if (status === 'NON_COMPLIANT') return 'destructive';
  return 'secondary';
}

function commandBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
      return 'warning';
    case 'RUNNING':
      return 'info';
    default:
      return 'secondary';
  }
}

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

function activityBadgeVariant(type: ActivityType, severity?: string): BadgeVariant {
  switch (type) {
    case 'HEARTBEAT':
      return 'info';
    case 'COMMAND':
      return 'purple';
    case 'ALERT':
      return severity === 'CRITICAL' ? 'destructive' : 'warning';
    default:
      return 'secondary';
  }
}

function InfoTile({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardContent className="p-4 space-y-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={`block text-xs text-slate-900 break-words ${mono ? 'font-mono text-[12px] text-slate-800' : 'font-semibold text-slate-900'}`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="p-10 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
      <div className="inline-flex p-3 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ErrorState
      title="Endpoint Data Notice"
      message={message}
      onRetry={onRetry}
      retryLabel="Retry"
    />
  );
}

function TabSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-lg border border-slate-200" />
      ))}
    </div>
  );
}

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Sub-tab search and filter states
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('ALL');
  const [commandStatusFilter, setCommandStatusFilter] = useState('ALL');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState('ALL');

  const detail = useDeviceDetail(id);
  const hardware = useDeviceHardware(id, activeTab === 'hardware');
  const software = useDeviceSoftware(id, activeTab === 'software');
  const activity = useDeviceActivity(id, activeTab === 'activity');

  const handleTabChange = (value: string) => setActiveTab(value as TabValue);

  const handleActionClick = (actionName: string) => {
    setActionNotice(`Remote action '${actionName}' initiated for this device.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const copyDeviceId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Invalid / missing device id
  if (!id) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Breadcrumbs deviceName="Unknown" />
        <TabError message="This device route is missing a device identifier." onRetry={() => detail.refetch()} />
      </div>
    );
  }

  // Detail error state
  if (detail.isError) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Breadcrumbs deviceName="Error" />
        <TabError
          message={
            detail.error instanceof Error
              ? detail.error.message === 'Device not found'
                ? 'This device could not be found, or it is outside your organization.'
                : detail.error.message
              : 'The device detail could not be loaded.'
          }
          onRetry={() => detail.refetch()}
        />
      </div>
    );
  }

  // Initial detail loading
  if (detail.isLoading || !detail.data) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse" data-testid="device-detail-loading">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-28 w-full bg-slate-200 rounded-xl border border-slate-300" />
        <div className="h-10 w-full bg-slate-100 rounded-lg border border-slate-200" />
        <div className="h-72 bg-slate-100 rounded-xl border border-slate-200" />
      </div>
    );
  }

  const overview = detail.data.overview;
  const statusText = overview.status.replace('_', ' ');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs deviceName={overview.deviceName} />

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-blue-500 hover:text-blue-700 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Device Header Card */}
      <div className="pb-5 border border-slate-200 bg-white p-6 rounded-xl shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5 flex-wrap">
                  {overview.deviceName}
                  <button
                    onClick={copyDeviceId}
                    title="Click to copy device ID"
                    className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 font-normal px-2 py-0.5 rounded bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    <span>{overview.serialNumber}</span>
                    {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {overview.hostname} • IP {overview.ipAddress || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Badge variant={statusBadgeVariant(overview.status)} className="text-[11px] font-semibold">
                {statusText}
              </Badge>
              <Badge variant={complianceBadgeVariant(overview.complianceStatus)} className="text-[11px] font-medium">
                {overview.complianceStatus.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[11px] border-slate-200 text-slate-600 bg-slate-50 font-normal">
                <Clock className="w-3 h-3 text-slate-500" />
                Last seen {formatRelativeTime(overview.lastSeenAt)}
              </Badge>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Lock Workstation')}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Lock</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Restart Host')}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Restart</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Shutdown Host')}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <Power className="w-3.5 h-3.5 text-rose-600" />
              <span>Shutdown</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleActionClick('Sync Policies')}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sync Policy</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => detail.refetch()}
              disabled={detail.isFetching}
              className="h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${detail.isFetching ? 'animate-spin' : ''}`} />
              <span>{detail.isFetching ? 'Syncing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabsRoot value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-colors"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoTile label="Status" value={<Badge variant={statusBadgeVariant(overview.status)} className="text-[11px] font-medium">{statusText}</Badge>} />
            <InfoTile label="Compliance" value={<Badge variant={complianceBadgeVariant(overview.complianceStatus)} className="text-[11px] font-medium">{overview.complianceStatus.replace('_', ' ')}</Badge>} />
            <InfoTile label="Operating System" value={`${overview.os}${overview.osVersion ? ` · ${overview.osVersion}` : ''}`} />
            <InfoTile label="Architecture" value={overview.architecture ?? '—'} />
            <InfoTile label="Manufacturer" value={overview.manufacturer || '—'} />
            <InfoTile label="Model" value={overview.model || '—'} />
            <InfoTile label="Serial Number" value={overview.serialNumber} mono />
            <InfoTile label="IP Address" value={overview.ipAddress || '—'} mono />
            <InfoTile label="Agent Version" value={overview.agentVersion ? `v${overview.agentVersion}` : '—'} mono />
            <InfoTile label="Last Seen" value={formatDateTime(overview.lastSeenAt)} />
            <InfoTile label="Registered" value={formatDateTime(overview.registeredAt)} />
            <InfoTile label="Created" value={formatDateTime(overview.createdAt)} />
          </div>
        </TabsContent>

        {/* Hardware Tab */}
        <TabsContent value="hardware">
          {hardware.isLoading ? (
            <TabSkeleton rows={4} />
          ) : hardware.isError ? (
            <TabError message={hardware.error instanceof Error ? hardware.error.message : 'Hardware inventory could not be loaded.'} onRetry={() => hardware.refetch()} />
          ) : !hardware.data ? (
            <EmptyTab icon={Cpu} title="No hardware inventory" description="This device agent has not reported hardware specifications yet." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoTile label="CPU" value={hardware.data.cpu || '—'} />
              <InfoTile label="CPU Cores" value={hardware.data.cpuCores} />
              <InfoTile label="Memory (RAM)" value={formatBytes(hardware.data.ramBytes)} />
              <InfoTile label="Storage" value={formatBytes(hardware.data.storageBytes)} />
              <InfoTile label="Hardware Manufacturer" value={hardware.data.manufacturer || '—'} />
              <InfoTile label="Hardware Model" value={hardware.data.model || '—'} />
              <InfoTile label="Hardware Serial" value={hardware.data.serialNumber || '—'} mono />
              <InfoTile label="BIOS Version" value={hardware.data.biosVersion || '—'} mono />
            </div>
          )}
        </TabsContent>

        {/* Software Tab with Search */}
        <TabsContent value="software" className="space-y-3">
          {software.isLoading ? (
            <TabSkeleton rows={4} />
          ) : software.isError ? (
            <TabError message={software.error instanceof Error ? software.error.message : 'Software inventory could not be loaded.'} onRetry={() => software.refetch()} />
          ) : !software.data || software.data.length === 0 ? (
            <EmptyTab icon={Package} title="No software inventory" description="No installed software has been reported for this device yet." />
          ) : (
            <SoftwareSection
              items={software.data}
              searchTerm={softwareSearch}
              onSearchChange={setSoftwareSearch}
            />
          )}
        </TabsContent>

        {/* Policies Tab with Filter */}
        <TabsContent value="policies" className="space-y-3">
          {detail.data.policies.length === 0 ? (
            <EmptyTab icon={ShieldCheck} title="No policies assigned" description="This device currently has no configuration or security policies assigned." />
          ) : (
            <PoliciesSection
              policies={detail.data.policies}
              filter={policyTypeFilter}
              onFilterChange={setPolicyTypeFilter}
            />
          )}
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance">
          {detail.data.compliance.length === 0 ? (
            <EmptyTab icon={CheckSquare} title="No compliance evaluations" description="No compliance rules have been evaluated against this device yet." />
          ) : (
            <ComplianceList results={detail.data.compliance} />
          )}
        </TabsContent>

        {/* Commands Tab with Status Filter */}
        <TabsContent value="commands" className="space-y-3">
          {detail.data.commands.length === 0 ? (
            <EmptyTab icon={Terminal} title="No commands issued" description="No remote commands have been dispatched to this device." />
          ) : (
            <CommandsSection
              commands={detail.data.commands}
              filter={commandStatusFilter}
              onFilterChange={setCommandStatusFilter}
            />
          )}
        </TabsContent>

        {/* Activity Tab with Category Filter */}
        <TabsContent value="activity" className="space-y-3">
          {activity.isLoading ? (
            <TabSkeleton rows={4} />
          ) : activity.isError ? (
            <TabError message={activity.error instanceof Error ? activity.error.message : 'Activity stream could not be loaded.'} onRetry={() => activity.refetch()} />
          ) : !activity.data || activity.data.length === 0 ? (
            <EmptyTab icon={Activity} title="No activity reported" description="No heartbeats, commands or alerts have been recorded for this device." />
          ) : (
            <ActivitySection
              events={activity.data}
              filter={activityCategoryFilter}
              onFilterChange={setActivityCategoryFilter}
            />
          )}
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

function Breadcrumbs({ deviceName }: { deviceName: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
      <Link to="/" className="hover:text-slate-800 transition-colors">
        Dashboard
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      <Link to="/devices" className="hover:text-slate-800 transition-colors">
        Devices
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-slate-900 font-semibold">{deviceName}</span>
    </nav>
  );
}

function SoftwareSection({
  items,
  searchTerm,
  onSearchChange,
}: {
  items: DeviceSoftwareItem[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.publisher && item.publisher.toLowerCase().includes(term)) ||
        (item.version && item.version.toLowerCase().includes(term))
    );
  }, [items, searchTerm]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search software or publisher..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          />
        </div>
        <span className="text-xs text-slate-500 self-start sm:self-center font-medium">
          Showing <strong className="text-slate-800">{filtered.length}</strong> of {items.length} applications
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
              <th className="px-4 py-2.5 font-semibold">Application</th>
              <th className="px-4 py-2.5 font-semibold">Version</th>
              <th className="px-4 py-2.5 font-semibold">Publisher</th>
              <th className="px-4 py-2.5 font-semibold">Architecture</th>
              <th className="px-4 py-2.5 font-semibold">Installed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 text-slate-900 font-semibold">{item.name}</td>
                <td className="px-4 py-3 text-slate-800 font-mono font-medium">{item.version}</td>
                <td className="px-4 py-3 text-slate-600">{item.publisher || '—'}</td>
                <td className="px-4 py-3 text-slate-500 font-mono">{item.architecture || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(item.installDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PoliciesSection({
  policies,
  filter,
  onFilterChange,
}: {
  policies: AssignedPolicy[];
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filtered = useMemo(() => {
    if (filter === 'ALL') return policies;
    return policies.filter((p) => p.policy.type === filter);
  }, [policies, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Type:</span>
        <div className="flex items-center gap-1">
          {['ALL', 'SECURITY', 'CONFIGURATION', 'COMPLIANCE'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <PoliciesList policies={filtered} />
    </div>
  );
}

function PoliciesList({ policies }: { policies: AssignedPolicy[] }) {
  return (
    <div className="space-y-3">
      {policies.map((assignment) => (
        <div key={assignment.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-900">{assignment.policy.name}</span>
              <Badge variant={policyTypeBadgeVariant(assignment.policy.type)} className="text-[10px] font-medium">
                {assignment.policy.type}
              </Badge>
              <Badge
                variant={assignment.policy.isActive ? 'success' : 'secondary'}
                className="text-[10px] font-medium"
              >
                {assignment.policy.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {assignment.policy.description && (
              <p className="text-[11px] text-slate-600">{assignment.policy.description}</p>
            )}
          </div>
          <div className="text-[11px] text-slate-500 shrink-0 text-left sm:text-right">
            <span>Priority <strong className="text-slate-700 font-medium">{assignment.priority}</strong></span>
            <span className="block text-slate-400 font-mono">{formatDateTime(assignment.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComplianceList({ results }: { results: ComplianceResult[] }) {
  return (
    <div className="space-y-3">
      {results.map((result) => (
        <div key={result.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-2 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-900">
                {result.rule ? result.rule.name : 'Managed security rule'}
              </span>
              <Badge variant={checkBadgeVariant(result.status)} className="text-[10px] font-medium">
                {result.status.replace('_', ' ')}
              </Badge>
            </div>
            {result.reason && <p className="text-[11px] text-slate-600">{result.reason}</p>}
            {result.rule?.description && (
              <p className="text-[11px] text-slate-500">{result.rule.description}</p>
            )}
          </div>
          <div className="text-[11px] text-slate-500 shrink-0 text-left sm:text-right font-mono">
            <span className="text-slate-600 font-medium">{result.rule ? result.rule.ruleType : 'GENERAL'}</span>
            <span className="block text-slate-400">{formatDateTime(result.evaluatedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandsSection({
  commands,
  filter,
  onFilterChange,
}: {
  commands: CommandRecord[];
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filtered = useMemo(() => {
    if (filter === 'ALL') return commands;
    return commands.filter((c) => c.status === filter);
  }, [commands, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Status:</span>
        <div className="flex items-center gap-1">
          {['ALL', 'COMPLETED', 'FAILED', 'PENDING'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <CommandsTable commands={filtered} />
    </div>
  );
}

function CommandsTable({ commands }: { commands: CommandRecord[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
            <th className="px-4 py-2.5 font-semibold">Type</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Requested By</th>
            <th className="px-4 py-2.5 font-semibold">Created</th>
            <th className="px-4 py-2.5 font-semibold">Completed</th>
            <th className="px-4 py-2.5 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {commands.map((command) => (
            <tr key={command.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono font-semibold text-blue-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {command.type}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={commandBadgeVariant(command.status)} className="text-[10px] font-medium">
                  {command.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-700 font-medium">{command.requestedBy || '—'}</td>
              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{formatDateTime(command.createdAt)}</td>
              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{formatDateTime(command.completedAt)}</td>
              <td className="px-4 py-3 text-slate-600 max-w-[240px] truncate" title={command.result ?? command.errorMessage ?? ''}>
                {command.errorMessage || command.result || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivitySection({
  events,
  filter,
  onFilterChange,
}: {
  events: ActivityEvent[];
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filtered = useMemo(() => {
    if (filter === 'ALL') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Category:</span>
        <div className="flex items-center gap-1">
          {['ALL', 'HEARTBEAT', 'COMMAND', 'ALERT'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ActivityTimeline events={filtered} />
    </div>
  );
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="space-y-2.5">
      {events.map((event) => (
        <div key={event.id} className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-xs flex items-start gap-3">
          <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-blue-600" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={activityBadgeVariant(event.type, event.severity)} className="text-[10px] font-medium">
                {event.type}
              </Badge>
              {event.severity && (
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">{event.severity}</span>
              )}
              {event.status && (
                <span className="text-[10px] text-slate-500 font-medium">{event.status}</span>
              )}
            </div>
            <p className="text-xs text-slate-800 mt-1 font-medium">{event.description}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {formatDateTime(event.timestamp)}
              <span className="mx-1.5">•</span>
              {formatRelativeTime(event.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}