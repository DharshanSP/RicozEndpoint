import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Root as TabsRoot, List as TabsList, Trigger as TabsTrigger, Content as TabsContent } from '@radix-ui/react-tabs';
import {
  ArrowLeft,
  Activity,
  CheckSquare,
  Clock,
  Cpu,
  Lock,
  Package,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { useDeviceActivity, useDeviceDetail, useDeviceHardware, useDeviceSoftware } from '../hooks/useDeviceQueries';
import { useCreateCommand } from '../hooks/useCommands';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDateTime, formatRelativeTime } from '../lib/format';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ErrorState } from '../components/ErrorState';
import type { CommandType } from '../types/command';
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
  { value: 'actions', label: 'Actions' },
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

  const detail = useDeviceDetail(id);
  const hardware = useDeviceHardware(id, activeTab === 'hardware');
  const software = useDeviceSoftware(id, activeTab === 'software');
  const activity = useDeviceActivity(id, activeTab === 'activity');

  const handleTabChange = (value: string) => setActiveTab(value as TabValue);

  // Invalid / missing device id
  if (!id) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <BackLink />
        <TabError message="This device route is missing a device identifier." onRetry={() => detail.refetch()} />
      </div>
    );
  }

  // Detail error state (covers 401, 404, 500, network)
  if (detail.isError) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <BackLink />
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
        <div className="h-16 w-full bg-slate-200 rounded-lg border border-slate-300" />
        <div className="h-10 w-2/3 bg-slate-200 rounded-lg border border-slate-300" />
        <div className="h-72 bg-slate-100 rounded-lg border border-slate-200" />
      </div>
    );
  }

  const overview = detail.data.overview;
  const statusText = overview.status.replace('_', ' ');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb + back */}
      <BackLink />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-6 rounded-xl border shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5 flex-wrap">
                {overview.deviceName}
                <span className="text-xs font-mono text-slate-500 font-normal px-2 py-0.5 rounded bg-slate-100 border border-slate-200">{overview.serialNumber}</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-mono">{overview.hostname} • {overview.ipAddress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Badge variant={statusBadgeVariant(overview.status)} className="text-[11px] font-medium">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => detail.refetch()}
          disabled={detail.isFetching}
          className="self-start md:self-auto h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${detail.isFetching ? 'animate-spin' : ''}`} />
          <span>{detail.isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
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

        {/* Overview */}
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

        {/* Hardware */}
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

        {/* Software */}
        <TabsContent value="software">
          {software.isLoading ? (
            <TabSkeleton rows={4} />
          ) : software.isError ? (
            <TabError message={software.error instanceof Error ? software.error.message : 'Software inventory could not be loaded.'} onRetry={() => software.refetch()} />
          ) : !software.data || software.data.length === 0 ? (
            <EmptyTab icon={Package} title="No software inventory" description="No installed software has been reported for this device yet." />
          ) : (
            <SoftwareTable items={software.data} />
          )}
        </TabsContent>

        {/* Policies */}
        <TabsContent value="policies">
          {detail.data.policies.length === 0 ? (
            <EmptyTab icon={ShieldCheck} title="No policies assigned" description="This device currently has no configuration or security policies assigned." />
          ) : (
            <PoliciesList policies={detail.data.policies} />
          )}
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance">
          {detail.data.compliance.length === 0 ? (
            <EmptyTab icon={CheckSquare} title="No compliance evaluations" description="No compliance rules have been evaluated against this device yet." />
          ) : (
            <ComplianceList results={detail.data.compliance} />
          )}
        </TabsContent>

        {/* Commands */}
        <TabsContent value="commands">
          {detail.data.commands.length === 0 ? (
            <EmptyTab icon={Terminal} title="No commands issued" description="No remote commands have been dispatched to this device." />
          ) : (
            <CommandsTable commands={detail.data.commands} />
          )}
        </TabsContent>

        {/* Actions */}
        <TabsContent value="actions">
          <ActionsTab deviceId={overview.id} />
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          {activity.isLoading ? (
            <TabSkeleton rows={4} />
          ) : activity.isError ? (
            <TabError message={activity.error instanceof Error ? activity.error.message : 'Activity stream could not be loaded.'} onRetry={() => activity.refetch()} />
          ) : !activity.data || activity.data.length === 0 ? (
            <EmptyTab icon={Activity} title="No activity reported" description="No heartbeats, commands or alerts have been recorded for this device." />
          ) : (
            <ActivityTimeline events={activity.data} />
          )}
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/devices"
      className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Back to Fleet Devices</span>
    </Link>
  );
}

function SoftwareTable({ items }: { items: DeviceSoftwareItem[] }) {
  return (
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
          {items.map((item) => (
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

interface CommandAction {
  type: CommandType;
  label: string;
  description: string;
  icon: LucideIcon;
  destructive: boolean;
}

const COMMAND_ACTIONS: CommandAction[] = [
  {
    type: 'REFRESH_INVENTORY',
    label: 'Refresh Inventory',
    description: 'Ask the agent to re-collect hardware and software inventory.',
    icon: RefreshCw,
    destructive: false,
  },
  {
    type: 'SYNC_POLICY',
    label: 'Sync Policy',
    description: 'Force the agent to re-fetch and apply its effective policies immediately.',
    icon: ShieldCheck,
    destructive: false,
  },
  {
    type: 'LOCK_DEVICE',
    label: 'Lock Device',
    description: 'Immediately lock the workstation session. Requires confirmation.',
    icon: Lock,
    destructive: true,
  },
  {
    type: 'RESTART_DEVICE',
    label: 'Restart Device',
    description: 'Force a system restart of the endpoint. Requires confirmation.',
    icon: RotateCcw,
    destructive: true,
  },
  {
    type: 'SHUTDOWN_DEVICE',
    label: 'Shutdown Device',
    description: 'Power the endpoint down. Requires confirmation.',
    icon: PowerOff,
    destructive: true,
  },
];

function ActionsTab({ deviceId }: { deviceId: string }) {
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);
  const createCommand = useCreateCommand(deviceId);
  const [pendingType, setPendingType] = useState<CommandType | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!canManage) {
    return (
      <EmptyTab
        icon={ShieldAlert}
        title="Read-only access"
        description="Your role does not permit issuing remote commands. This requires IT_ADMIN or above."
      />
    );
  }

  const pendingAction = COMMAND_ACTIONS.find((action) => action.type === pendingType) ?? null;

  const dispatch = (type: CommandType) => {
    setConfirmed(false);
    const action = COMMAND_ACTIONS.find((a) => a.type === type)!;
    const destructive = action.destructive;
    if (destructive) {
      setPendingType(type);
      return;
    }
    createCommand.mutate({ deviceId, type, confirmed: false });
  };

  const confirmDispatch = () => {
    if (!pendingAction || !confirmed) return;
    createCommand.mutate(
      { deviceId, type: pendingAction.type, confirmed: true },
      {
        onSuccess: () => {
          setPendingType(null);
          setConfirmed(false);
        },
      },
    );
  };

  const running = createCommand.isPending;

  return (
    <div className="space-y-3">
      {createCommand.isError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {(createCommand.error as Error).message}
        </div>
      )}
      {createCommand.isSuccess && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Command {String((createCommand.data as { data?: { type?: string } }).data?.type ?? '')} queued for this device.
        </div>
      )}

      {pendingAction && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <pendingAction.icon className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-slate-900">
              Confirm {pendingAction.label} ({pendingAction.type})
            </span>
          </div>
          <p className="text-xs text-slate-700">{pendingAction.description}.</p>
          <p className="text-[11px] text-amber-700">
            This action is destructive and irreversible once the agent executes it. The server will reject it without an explicit confirmation.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            I understand the consequences and confirm this action.
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingType(null)} disabled={running}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDispatch}
              disabled={running || !confirmed}
            >
              {running ? 'Confirming...' : 'Confirm & Send'}
            </Button>
          </div>
        </div>
      )}

      {COMMAND_ACTIONS.map((action) => (
        <div key={action.type} className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-md border shrink-0 ${action.destructive ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
              <action.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-900">{action.label}</span>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {action.type}
                </span>
                {action.destructive && (
                  <Badge variant="destructive" className="text-[10px] font-medium">
                    Destructive
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{action.description}</p>
            </div>
          </div>
          <Button
            variant={action.destructive ? 'outline' : 'default'}
            size="sm"
            className={action.destructive ? 'text-rose-700 border-rose-300 hover:bg-rose-50' : ''}
            onClick={() => dispatch(action.type)}
            disabled={running}
          >
            {action.destructive ? 'Request...' : 'Run'}
          </Button>
        </div>
      ))}
    </div>
  );
}