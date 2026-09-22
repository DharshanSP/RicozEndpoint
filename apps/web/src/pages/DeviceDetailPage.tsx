import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Root as TabsRoot, List as TabsList, Trigger as TabsTrigger, Content as TabsContent } from '@radix-ui/react-tabs';
import {
  ArrowLeft,
  Activity,
  CheckSquare,
  Clock,
  Cpu,
  Package,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { useDeviceActivity, useDeviceDetail, useDeviceHardware, useDeviceSoftware } from '../hooks/useDeviceQueries';
import { formatBytes, formatDateTime, formatRelativeTime } from '../lib/format';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
    <Card className="border-slate-800/80 bg-slate-900/40">
      <CardContent className="p-4 space-y-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span
          className={`block text-sm text-slate-200 break-words ${mono ? 'font-mono text-[13px]' : 'font-medium'}`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="p-10 rounded-xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
      <div className="inline-flex p-3 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
      <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <p className="text-xs text-slate-400 max-w-md mx-auto">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry</span>
      </Button>
    </div>
  );
}

function TabSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-900/50 rounded-lg border border-slate-800/80" />
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
        <div className="h-16 w-full bg-slate-900/60 rounded-lg border border-slate-800/80" />
        <div className="h-10 w-2/3 bg-slate-900/50 rounded-lg border border-slate-800/80" />
        <div className="h-72 bg-slate-900/40 rounded-lg border border-slate-800/80" />
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
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2 flex-wrap">
                {overview.deviceName}
                <span className="text-xs font-mono text-slate-500 font-normal">{overview.serialNumber}</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{overview.hostname} • {overview.ipAddress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusBadgeVariant(overview.status)} className="text-[10px]">
              {statusText}
            </Badge>
            <Badge variant={complianceBadgeVariant(overview.complianceStatus)} className="text-[10px]">
              {overview.complianceStatus.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] border-slate-800 text-slate-400">
              <Clock className="w-3 h-3" />
              Last seen {formatRelativeTime(overview.lastSeenAt)}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => detail.refetch()}
          disabled={detail.isFetching}
          className="self-start md:self-auto h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${detail.isFetching ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Tabs */}
      <TabsRoot value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-900/70 border border-slate-800 p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoTile label="Status" value={<Badge variant={statusBadgeVariant(overview.status)} className="text-[10px]">{statusText}</Badge>} />
            <InfoTile label="Compliance" value={<Badge variant={complianceBadgeVariant(overview.complianceStatus)} className="text-[10px]">{overview.complianceStatus.replace('_', ' ')}</Badge>} />
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
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Back to Fleet Devices</span>
    </Link>
  );
}

function SoftwareTable({ items }: { items: DeviceSoftwareItem[] }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-slate-900/70 text-slate-400 uppercase tracking-wider text-[11px]">
            <th className="px-4 py-2.5 font-semibold">Application</th>
            <th className="px-4 py-2.5 font-semibold">Version</th>
            <th className="px-4 py-2.5 font-semibold">Publisher</th>
            <th className="px-4 py-2.5 font-semibold">Architecture</th>
            <th className="px-4 py-2.5 font-semibold">Installed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 text-slate-200 font-medium">{item.name}</td>
              <td className="px-4 py-3 text-slate-300 font-mono">{item.version}</td>
              <td className="px-4 py-3 text-slate-400">{item.publisher || '—'}</td>
              <td className="px-4 py-3 text-slate-400 font-mono">{item.architecture || '—'}</td>
              <td className="px-4 py-3 text-slate-400">{formatDateTime(item.installDate)}</td>
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
        <div key={assignment.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-slate-200">{assignment.policy.name}</span>
              <Badge variant={policyTypeBadgeVariant(assignment.policy.type)} className="text-[10px]">
                {assignment.policy.type}
              </Badge>
              <Badge
                variant={assignment.policy.isActive ? 'success' : 'secondary'}
                className="text-[10px]"
              >
                {assignment.policy.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {assignment.policy.description && (
              <p className="text-[11px] text-slate-400">{assignment.policy.description}</p>
            )}
          </div>
          <div className="text-[11px] text-slate-500 shrink-0 text-left sm:text-right">
            <span>Priority {assignment.priority}</span>
            <span className="block">{formatDateTime(assignment.createdAt)}</span>
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
        <div key={result.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/90 flex flex-col sm:flex-row items-start gap-2 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">
                {result.rule ? result.rule.name : 'Managed security rule'}
              </span>
              <Badge variant={checkBadgeVariant(result.status)} className="text-[10px]">
                {result.status.replace('_', ' ')}
              </Badge>
            </div>
            {result.reason && <p className="text-[11px] text-slate-400">{result.reason}</p>}
            {result.rule?.description && (
              <p className="text-[11px] text-slate-500">{result.rule.description}</p>
            )}
          </div>
          <div className="text-[11px] text-slate-500 shrink-0 text-left sm:text-right">
            <span>{result.rule ? result.rule.ruleType : 'GENERAL'}</span>
            <span className="block">{formatDateTime(result.evaluatedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandsTable({ commands }: { commands: CommandRecord[] }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-slate-900/70 text-slate-400 uppercase tracking-wider text-[11px]">
            <th className="px-4 py-2.5 font-semibold">Type</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Requested By</th>
            <th className="px-4 py-2.5 font-semibold">Created</th>
            <th className="px-4 py-2.5 font-semibold">Completed</th>
            <th className="px-4 py-2.5 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {commands.map((command) => (
            <tr key={command.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 text-slate-200 font-medium font-mono text-[11px]">{command.type}</td>
              <td className="px-4 py-3">
                <Badge variant={commandBadgeVariant(command.status)} className="text-[10px]">
                  {command.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-300">{command.requestedBy || '—'}</td>
              <td className="px-4 py-3 text-slate-400">{formatDateTime(command.createdAt)}</td>
              <td className="px-4 py-3 text-slate-400">{formatDateTime(command.completedAt)}</td>
              <td className="px-4 py-3 text-slate-400 max-w-[240px] truncate" title={command.result ?? command.errorMessage ?? ''}>
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
        <div key={event.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/90 flex items-start gap-3">
          <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={activityBadgeVariant(event.type, event.severity)} className="text-[10px]">
                {event.type}
              </Badge>
              {event.severity && (
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{event.severity}</span>
              )}
              {event.status && (
                <span className="text-[10px] text-slate-500">{event.status}</span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">{event.description}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
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