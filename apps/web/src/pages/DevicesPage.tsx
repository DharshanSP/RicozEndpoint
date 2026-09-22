import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Laptop,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Table2,
} from 'lucide-react';
import { useDeviceList } from '../hooks/useDeviceQueries';
import { formatRelativeTime } from '../lib/format';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import type {
  DeviceComplianceStatus,
  DeviceSortField,
  DeviceSortOrder,
  DeviceStatus,
} from '../types/device';
import type { DeviceListQuery } from '../lib/api/devicesApi';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

const STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NON_COMPLIANT', label: 'Non Compliant' },
];

const OS_OPTIONS = ['Windows', 'Windows Server', 'macOS', 'Ubuntu', 'Debian', 'Fedora', 'Linux'];

const SORT_OPTIONS: { value: DeviceSortField; label: string }[] = [
  { value: 'deviceName', label: 'Device Name' },
  { value: 'hostname', label: 'Hostname' },
  { value: 'os', label: 'OS' },
  { value: 'osVersion', label: 'OS Version' },
  { value: 'ipAddress', label: 'IP Address' },
  { value: 'agentVersion', label: 'Agent Version' },
  { value: 'status', label: 'Status' },
  { value: 'lastSeenAt', label: 'Last Seen' },
  { value: 'registeredAt', label: 'Registered' },
  { value: 'createdAt', label: 'Created' },
];

const PAGE_SIZES = [10, 25, 50];

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

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const filterSelectClass =
  'h-9 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2.5 pr-7 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 cursor-pointer';

export function DevicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [status, setStatus] = useState<DeviceStatus | ''>('');
  const [os, setOs] = useState('');
  const [sortBy, setSortBy] = useState<DeviceSortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<DeviceSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const query = useMemo<DeviceListQuery>(
    () => ({
      page,
      limit,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      status: status || undefined,
      os: os || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, debouncedSearch, status, os, sortBy, sortOrder],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useDeviceList(query);

  const devices = data?.devices ?? [];
  const pagination = data?.pagination;

  const resetPage = () => setPage(1);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    resetPage();
  };

  const handleSortOrderToggle = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    resetPage();
  };

  const hasFilters = !!(debouncedSearch.trim() || status || os);

  // Error state
  if (isError && !isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          isRefreshing={isFetching}
          onRefresh={() => refetch()}
        />
        <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Unable to Load Devices</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {error instanceof Error ? error.message : 'The device service could not be reached.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </Button>
        </div>
      </div>
    );
  }

  // Initial loading skeleton
  if (isLoading && !data) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse" data-testid="devices-loading">
        <PageHeader isRefreshing={false} onRefresh={() => undefined} />
        <div className="h-12 w-full bg-slate-900/60 rounded-lg border border-slate-800/80" />
        <div className="h-96 bg-slate-900/40 rounded-lg border border-slate-800/80" />
      </div>
    );
  }

  const from = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader isRefreshing={isFetching} onRefresh={() => refetch()} />

      {/* Filters & Controls */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/90 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, hostname, serial number, IP..."
              className="w-full pl-9 pr-3 h-9 rounded-md bg-slate-950/60 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as DeviceStatus | '');
                resetPage();
              }}
              className={filterSelectClass}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* OS filter */}
            <select
              aria-label="Filter by operating system"
              value={os}
              onChange={(e) => {
                setOs(e.target.value);
                resetPage();
              }}
              className={filterSelectClass}
            >
              <option value="">All OS</option>
              {OS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            {/* Sort field */}
            <select
              aria-label="Sort devices by"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as DeviceSortField);
                setPage(1);
              }}
              className={filterSelectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Sort direction + page size */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSortOrderToggle}
              aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
              className="h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5 px-2.5"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'text-blue-400' : ''}`} />
              <span className="uppercase text-[11px]">{sortOrder}</span>
            </Button>

            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                resetPage();
              }}
              className={filterSelectClass}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / pg
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results summary strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            {hasFilters
              ? 'Filtering the enrolled fleet'
              : 'Showing the full enrolled fleet'}
            {pagination && <span className="text-slate-500">•</span>}
            {pagination && (
              <span className="font-medium text-slate-300">
                {pagination.total} device{pagination.total === 1 ? '' : 's'}
              </span>
            )}
          </span>
          {pagination && pagination.total > 0 && (
            <button
              onClick={() => hasFilters && resetPage()}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && devices.length === 0 && (
        <div className="p-10 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Server className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">No devices found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {hasFilters
              ? 'No enrolled endpoints match the current filters or search query.'
              : 'No endpoints have enrolled with the agent yet.'}
          </p>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setStatus('');
                setOs('');
                resetPage();
              }}
              className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Device table */}
      {devices.length > 0 && (
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900/70 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-2.5 font-semibold">Device</th>
                  <th className="px-4 py-2.5 font-semibold">Hostname</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">OS</th>
                  <th className="px-4 py-2.5 font-semibold">OS Version</th>
                  <th className="px-4 py-2.5 font-semibold">IP Address</th>
                  <th className="px-4 py-2.5 font-semibold">Agent</th>
                  <th className="px-4 py-2.5 font-semibold">Compliance</th>
                  <th className="px-4 py-2.5 font-semibold">Last Seen</th>
                  <th className="px-4 py-2.5 font-semibold">Manufacturer / Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/devices/${device.id}`}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                      >
                        <Laptop className="w-3.5 h-3.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="block font-semibold text-slate-200 truncate">{device.deviceName}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">{device.serialNumber}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{device.hostname}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(device.status)} className="text-[10px]">
                        {device.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{device.os}</td>
                    <td className="px-4 py-3 text-slate-400">{device.osVersion}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{device.ipAddress}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">v{device.agentVersion}</td>
                    <td className="px-4 py-3">
                      <Badge variant={complianceBadgeVariant(device.complianceStatus)} className="text-[10px]">
                        {device.complianceStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatRelativeTime(device.lastSeenAt)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {device.manufacturer} {device.model}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-800/80 bg-slate-900/60">
              <span className="text-[11px] text-slate-400">
                Showing <strong className="text-slate-200">{from}</strong>–<strong className="text-slate-200">{to}</strong> of{' '}
                <strong className="text-slate-200">{pagination.total}</strong> devices
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 gap-1 px-2.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </Button>
                <span className="text-[11px] text-slate-400 px-1">
                  Page <strong className="text-slate-200">{pagination.page}</strong> of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 gap-1 px-2.5"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PageHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

function PageHeader({ isRefreshing, onRefresh }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Fleet Endpoints</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Centralized inventory and real-time health across enrolled organization devices.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Badge variant="outline" className="gap-1.5 py-1 px-3 border-slate-800 text-slate-300">
          <Table2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Managed Devices</span>
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5"
        >
          {isRefreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </Button>
      </div>
    </div>
  );
}