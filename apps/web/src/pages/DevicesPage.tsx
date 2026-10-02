import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDeviceList, useDeleteDevice } from '../hooks/useDeviceQueries';
import { formatRelativeTime } from '../lib/format';
import type { DeviceSortField, DeviceSortOrder, DeviceStatus } from '../types/device';
import {
  Laptop,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Server,
  SlidersHorizontal,
  KeyRound,
  ShieldAlert,
  Trash2,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchApi, apiBaseUrl } from '../lib/api';

// OS Badge Icon & Label helper
function getOsVisual(os: string) {
  const osLower = (os || '').toLowerCase();
  if (osLower.includes('win')) {
    return {
      label: 'Windows',
      badgeColor: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }
  if (osLower.includes('mac') || osLower.includes('darwin')) {
    return {
      label: 'macOS',
      badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    };
  }
  return {
    label: 'Linux',
    badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function getStatusBadge(devStatus: string) {
  const s = (devStatus || '').toUpperCase();
  if (s === 'ONLINE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Online
      </span>
    );
  }
  if (s === 'OFFLINE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-amber-200 bg-amber-50 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Offline
      </span>
    );
  }
  if (s === 'NON_COMPLIANT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-rose-200 bg-rose-50 text-rose-700">
        <ShieldAlert className="w-3 h-3 text-rose-600" />
        Non-Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-blue-200 bg-blue-50 text-blue-700">
      <Clock className="w-3 h-3 text-blue-600" />
      Pending
    </span>
  );
}

function getComplianceBadge(complianceStatus?: string) {
  const s = (complianceStatus || '').toUpperCase();
  if (s === 'NON_COMPLIANT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-rose-200 bg-rose-50 text-rose-700">
        <ShieldAlert className="w-3 h-3 text-rose-600" />
        Non-Compliant
      </span>
    );
  }
  if (s === 'COMPLIANT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-600">
      <Clock className="w-3 h-3 text-slate-500" />
      Not Evaluated
    </span>
  );
}

export function DevicesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canManageDevices = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);
  const deleteDevice = useDeleteDevice();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Filter & pagination state
  const paramStatus = searchParams.get('status') || 'ALL';
  const paramSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState<string>(paramSearch);
  const [status, setStatus] = useState<string>(paramStatus);
  const [compliance, setCompliance] = useState<string>('ALL');
  const [os, setOs] = useState<string>('ALL');
  const [manufacturer, setManufacturer] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<DeviceSortField>('lastSeenAt');
  const [sortOrder, setSortOrder] = useState<DeviceSortOrder>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Sync state if URL query params change
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && urlStatus !== status) {
      setStatus(urlStatus);
      setPage(1);
    }
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== search) {
      setSearch(urlSearch);
      setPage(1);
    }
  }, [searchParams]);

  // UI state
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  // Enrollment modal state
  const [enrollLabel, setEnrollLabel] = useState('');
  const [enrollMaxUses, setEnrollMaxUses] = useState(5);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateToken = async () => {
    setEnrollLoading(true);
    setEnrollError(null);
    setGeneratedToken(null);
    try {
      const res = await fetchApi<{ token: string; id: string }>('/enrollment-tokens', {
        method: 'POST',
        body: JSON.stringify({ label: enrollLabel || 'Quick Enroll', maxUses: enrollMaxUses }),
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to create token');
      setGeneratedToken(res.data.token);
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : 'Failed to generate token');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlCommand = generatedToken
    ? `curl -X POST ${apiBaseUrl}/enroll -H "Content-Type: application/json" -d '{"enrollmentToken":"${generatedToken}","hostname":"my-device","serialNumber":"SN-001","os":"Windows","osVersion":"11","architecture":"x64","agentVersion":"1.0.0"}'`
    : '';

  const handleDownloadAgentFile = () => {
    const link = document.createElement('a');
    link.href = '/downloads/RicozEndpointAgent.exe';
    link.download = 'RicozEndpointAgent.exe';
    link.click();
  };

  const openDeleteConfirm = (device: { id: string; deviceName?: string; hostname?: string }) => {
    setDeleteTarget({ id: device.id, name: device.deviceName || device.hostname || device.id });
    setDeletePassword('');
    setDeleteError(null);
  };

  const closeDeleteConfirm = () => {
    setDeleteTarget(null);
    setDeletePassword('');
    setDeleteError(null);
    deleteDevice.reset();
  };

  const confirmDeleteDevice = async () => {
    if (!deleteTarget || !deletePassword.trim()) return;
    setDeleteError(null);
    try {
      const deletedName = deleteTarget.name;
      await deleteDevice.mutateAsync({ id: deleteTarget.id, password: deletePassword.trim() });
      closeDeleteConfirm();
      setDeleteNotice(`Device "${deletedName}" was successfully deleted.`);
      refetch();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete device');
    }
  };

  // Query parameters for real TanStack Query backend hook
  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search.trim() || undefined,
      status: status !== 'ALL' ? (status as DeviceStatus) : undefined,
      complianceStatus: compliance !== 'ALL' ? compliance : undefined,
      os: os !== 'ALL' ? os : undefined,
      manufacturer: manufacturer !== 'ALL' ? manufacturer : undefined,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, status, compliance, os, manufacturer, sortBy, sortOrder]
  );

  const { data, isLoading, isFetching, error, refetch } = useDeviceList(query);

  const rawDevices = useMemo(() => data?.devices ?? [], [data]);
  const pagination = data?.pagination ?? {
    page,
    limit: pageSize,
    total: rawDevices.length,
    totalPages: Math.max(1, Math.ceil(rawDevices.length / pageSize)),
  };

  // Client-side manufacturer filtering fallback if needed
  const devices = useMemo(() => {
    if (manufacturer === 'ALL') return rawDevices;
    return rawDevices.filter((d) =>
      (d.manufacturer || '').toLowerCase().includes(manufacturer.toLowerCase())
    );
  }, [rawDevices, manufacturer]);

  // Derived KPI metrics
  const metrics = useMemo(() => {
    return {
      totalDevices: status === 'ALL' ? pagination.total : pagination.total,
      onlineDevices:
        status === 'ONLINE'
          ? pagination.total
          : rawDevices.filter((d) => d.status?.toUpperCase() === 'ONLINE').length,
      offlineDevices:
        status === 'OFFLINE'
          ? pagination.total
          : rawDevices.filter((d) => d.status?.toUpperCase() === 'OFFLINE').length,
      pendingDevices:
        status === 'PENDING'
          ? pagination.total
          : rawDevices.filter((d) => d.status?.toUpperCase() === 'PENDING').length,
    };
  }, [pagination.total, rawDevices, status]);

  const hasActiveFilters =
    search.trim() !== '' ||
    status !== 'ALL' ||
    compliance !== 'ALL' ||
    os !== 'ALL' ||
    manufacturer !== 'ALL';

  const manufacturerOptions = useMemo(
    () => ['ALL', 'Dell Inc.', 'Apple', 'Lenovo', 'HP Inc.', 'Framework', 'Microsoft Corporation'],
    []
  );

  const handleSortClick = (field: DeviceSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'lastSeenAt' || field === 'registeredAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field: DeviceSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600" />
    );
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleComplianceChange = (val: string) => {
    setCompliance(val);
    setPage(1);
  };

  const handleOsChange = (val: string) => {
    setOs(val);
    setPage(1);
  };

  const handleManufacturerChange = (val: string) => {
    setManufacturer(val);
    setPage(1);
  };

const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('ALL');
    setCompliance('ALL');
    setOs('ALL');
    setManufacturer('ALL');
    setPage(1);
  };

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Devices</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage and monitor organization endpoints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
            title="Refresh Fleet Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isFetching ? 'Syncing...' : 'Sync'}</span>
          </Button>

          {canManageDevices && (
            <Button
              onClick={() => setShowEnrollModal(true)}
              className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Enroll Device</span>
            </Button>
          )}
        </div>
      </div>

      {/* Deletion success feedback banner */}
      {deleteNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-semibold p-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Enrollment Guide */}
      <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-100 border border-blue-200 text-blue-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Add devices to your fleet</h2>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Enroll Windows devices securely with a one-time token and the RicozEndpoint agent.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1 lg:max-w-3xl">
              {[
                'Open Enroll Device',
                'Generate a token',
                'Download the agent EXE',
                'Run it and paste the token',
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-2 rounded-md border border-blue-100 bg-white/80 px-2.5 py-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-slate-700">{step}</span>
                </div>
              ))}
            </div>

            {canManageDevices && (
              <Button
                size="sm"
                onClick={() => setShowEnrollModal(true)}
                className="h-9 shrink-0 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Start enrollment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fleet KPI Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Total Devices
              </span>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">
                {metrics.totalDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
              <Server className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Online */}
        <Card
          onClick={() => handleStatusChange(status === 'ONLINE' ? 'ALL' : 'ONLINE')}
          className={`cursor-pointer transition-all border-slate-200 bg-white shadow-xs hover:bg-slate-50 ${
            status === 'ONLINE' ? 'ring-1 ring-emerald-500 bg-emerald-50/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Online
              </span>
              <span className="text-xl font-bold text-emerald-600 mt-0.5 block">
                {metrics.onlineDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Offline */}
        <Card
          onClick={() => handleStatusChange(status === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
          className={`cursor-pointer transition-all border-slate-200 bg-white shadow-xs hover:bg-slate-50 ${
            status === 'OFFLINE' ? 'ring-1 ring-amber-500 bg-amber-50/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                Offline
              </span>
              <span className="text-xl font-bold text-amber-600 mt-0.5 block">
                {metrics.offlineDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card
          onClick={() => handleStatusChange(status === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`cursor-pointer transition-all border-slate-200 bg-white shadow-xs hover:bg-slate-50 ${
            status === 'PENDING' ? 'ring-1 ring-blue-500 bg-blue-50/50' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                Pending
              </span>
              <span className="text-xl font-bold text-blue-600 mt-0.5 block">
                {metrics.pendingDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-blue-50 border border-blue-200 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise Device Management Toolbar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by device name, hostname, serial number, IP..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-md bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Status:</span>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer py-1 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>

              {/* Compliance Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Compliance:</span>
                <select
                  value={compliance}
                  onChange={(e) => handleComplianceChange(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer py-1 font-medium"
                >
                  <option value="ALL">All</option>
                  <option value="COMPLIANT">Compliant</option>
                  <option value="NON_COMPLIANT">Non-Compliant</option>
                  <option value="UNTESTED">Not Evaluated</option>
                </select>
              </div>

              {/* OS Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">OS:</span>
                <select
                  value={os}
                  onChange={(e) => handleOsChange(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer py-1 font-medium"
                >
                  <option value="ALL">All OS</option>
                  <option value="Windows">Windows</option>
                  <option value="macOS">macOS</option>
                  <option value="Linux">Linux</option>
                </select>
              </div>

              {/* More Filters Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 ${
                  manufacturer !== 'ALL' || showMoreFilters
                    ? 'border-blue-300 text-blue-700 bg-blue-50/50'
                    : ''
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {manufacturer !== 'ALL' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </Button>
            </div>
          </div>

          {/* Expandable Secondary Filters */}
          {showMoreFilters && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px] font-medium">Manufacturer:</span>
                <select
                  value={manufacturer}
                  onChange={(e) => handleManufacturerChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  {manufacturerOptions.map((mfr) => (
                    <option key={mfr} value={mfr}>
                      {mfr === 'ALL' ? 'All Manufacturers' : mfr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px] font-medium">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as DeviceSortField);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="lastSeenAt">Last Seen</option>
                  <option value="deviceName">Device Name</option>
                  <option value="hostname">Hostname</option>
                  <option value="status">Status</option>
                  <option value="os">Operating System</option>
                  <option value="registeredAt">Registered Date</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    setPage(1);
                  }}
                  className="h-7 px-2 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1"
                >
                  {sortOrder === 'asc' ? (
                    <>
                      <ArrowUp className="w-3 h-3 text-blue-600" />
                      <span>Asc</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3 h-3 text-blue-600" />
                      <span>Desc</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                Active Filters:
              </span>

              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
                  Search: &quot;{search}&quot;
                  <button onClick={() => handleSearchChange('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {status !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
                  Status: {status}
                  <button onClick={() => handleStatusChange('ALL')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {os !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
                  OS: {os}
                  <button onClick={() => handleOsChange('ALL')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {manufacturer !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
                  Mfr: {manufacturer}
                  <button onClick={() => handleManufacturerChange('ALL')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={clearFilters}
                className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-medium ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {errorMessage && !isLoading && (
        <ErrorState
          title="Unable to load devices"
          message={errorMessage}
          onRetry={() => refetch()}
          retryLabel="Retry Connection"
          isRetrying={isFetching}
        />
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 animate-pulse">
            <div className="h-4 w-48 bg-slate-200 rounded" />
          </div>
          <div className="divide-y divide-slate-100 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-1/4">
                  <div className="w-8 h-8 rounded-lg bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-200 rounded hidden md:block" />
                <div className="h-4 w-20 bg-slate-200 rounded hidden sm:block" />
                <div className="h-7 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMessage && devices.length === 0 && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No devices found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No organization endpoints matched the current search and filter combination.'
                : 'No endpoints have been enrolled in this organization yet.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      {!isLoading && !errorMessage && devices.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
                  {/* Device Header */}
                  <th
                    onClick={() => handleSortClick('deviceName')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Device / Hostname</span>
                      {renderSortIndicator('deviceName')}
                    </div>
                  </th>

                  {/* OS Header */}
                  <th
                    onClick={() => handleSortClick('os')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Operating System</span>
                      {renderSortIndicator('os')}
                    </div>
                  </th>

                  {/* Status Header */}
                  <th
                    onClick={() => handleSortClick('status')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>

                  {/* Compliance Header */}
                  <th className="py-3 px-4 hidden md:table-cell">
                    <span>Compliance</span>
                  </th>

                  {/* IP Address Header */}
                  <th className="py-3 px-4 hidden md:table-cell">
                    <span>IP Address</span>
                  </th>

                  {/* Last Seen Header */}
                  <th
                    onClick={() => handleSortClick('lastSeenAt')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Last Seen</span>
                      {renderSortIndicator('lastSeenAt')}
                    </div>
                  </th>

                  {/* Agent Version Header */}
                  <th className="py-3 px-4 hidden lg:table-cell">
                    <span>Agent</span>
                  </th>

                  {/* Actions Header */}
                  <th className="py-3 px-4 text-right">
                    <span>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {devices.map((device) => {
                  const visual = getOsVisual(device.os);
                  return (
                    <tr
                      key={device.id}
                      onClick={() => navigate(`/devices/${device.id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Device & Hostname */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors shrink-0">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {device.deviceName}
                              </span>
                              {device.model && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 hidden xl:inline">
                                  {device.model}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate">
                              {device.hostname}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* OS & Version */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className={`text-[10px] ${visual.badgeColor}`}>
                            {device.os}
                          </Badge>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {device.osVersion}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(device.status)}
                      </td>

                      {/* Compliance */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        {getComplianceBadge(device.complianceStatus)}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          {device.ipAddress || '—'}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="text-slate-800 font-medium block">
                            {formatRelativeTime(device.lastSeenAt)}
                          </span>
                          {device.lastSeenAt && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {new Date(device.lastSeenAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Agent Version */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="font-mono text-[11px] text-slate-500">
                          {device.agentVersion ? `v${device.agentVersion.replace(/^v/, '')}` : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/devices/${device.id}`)}
                            className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                          >
                            <span>Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
{canManageDevices && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDeleteConfirm(device)}
                disabled={deleteDevice.isPending}
                className="h-7 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
                title="Delete Device"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range Counter */}
            <div className="text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {pagination.total === 0
                  ? 0
                  : Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
              </span>
              –
              <span className="font-semibold text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{pagination.total}</span> endpoints
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mr-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-800 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Prev Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                <span>Prev</span>
              </Button>

              {/* Page number buttons */}
              <div className="flex items-center gap-1">
                {[...Array(Math.min(pagination.totalPages, 5))].map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        page === pNum
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="h-7 px-2 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Device Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteDevice.isPending) {
            closeDeleteConfirm();
          }
        }}
        title="Delete Device"
        description={
          deleteTarget
            ? `Are you sure you want to permanently delete "${deleteTarget.name}"? This removes the device with all of its hardware/software inventory, compliance results, commands, and audit records. This action is irreversible.`
            : ''
        }
        icon={Trash2}
        variant="danger"
        confirmLabel="Delete Device"
        loading={deleteDevice.isPending}
        confirmDisabled={!deletePassword.trim()}
        onConfirm={confirmDeleteDevice}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Admin password</label>
            <input
              type="password"
              autoFocus
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmDeleteDevice();
              }}
              placeholder="Enter your password to confirm"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none bg-white text-slate-900"
            />
          </div>

          {deleteError && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {deleteError}
            </p>
          )}
        </div>
      </ConfirmDialog>

      {/* Enroll Device Modal Dialog */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Device</h3>
                  <p className="text-xs text-slate-500">Generate a token and enroll a Windows device</p>
                </div>
              </div>
              <button onClick={() => { setShowEnrollModal(false); setGeneratedToken(null); setEnrollError(null); }} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white/70 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500">Generate a secure enrollment token, then download the Windows enrollment file for the target machine.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Label (optional)</label>
                  <input
                    value={enrollLabel}
                    onChange={(e) => setEnrollLabel(e.target.value)}
                    placeholder="e.g. Finance Laptops"
                    className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Max Uses</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={enrollMaxUses}
                    onChange={(e) => setEnrollMaxUses(Number(e.target.value))}
                    className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {enrollError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{enrollError}</p>}

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAgentFile}
                className="w-full text-xs border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                    Download RicozEndpoint Agent (.exe)
              </Button>
              <p className="text-[11px] text-slate-500">
                Run the downloaded EXE on the target Windows machine and paste the token when prompted.
              </p>

              {!generatedToken ? (
                <Button onClick={handleGenerateToken} disabled={enrollLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  {enrollLoading ? 'Generating...' : <><KeyRound className="w-4 h-4" /> Generate Enrollment Token</>}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Token Generated
                      </span>
                      <button onClick={() => handleCopy(generatedToken)} className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy token'}
                      </button>
                    </div>
                    <code className="text-[11px] font-mono text-emerald-800 break-all block">{generatedToken}</code>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Run on target machine (curl)</span>
                      <button onClick={() => handleCopy(curlCommand)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy command'}
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{curlCommand}</pre>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setGeneratedToken(null); setEnrollLabel(''); setEnrollMaxUses(5); }}
                    className="w-full text-xs border-slate-200"
                  >
                    Generate another token
                  </Button>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowEnrollModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}