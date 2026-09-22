import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { DeviceSortField } from '../types/device';
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
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

// Helper to format human-readable relative time
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never (Pending)';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// OS Badge Icon & Label helper
function getOsVisual(os: string) {
  const osLower = os.toLowerCase();
  if (osLower.includes('win')) {
    return {
      label: 'Windows',
      badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    };
  }
  if (osLower.includes('mac') || osLower.includes('darwin')) {
    return {
      label: 'macOS',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
    };
  }
  return {
    label: 'Linux',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  };
}

export function DevicesPage() {
  const navigate = useNavigate();
  const {
    devices,
    pagination,
    metrics,
    loading,
    error,
    search,
    status,
    os,
    manufacturer,
    sortBy,
    sortOrder,
    page,
    pageSize,
    hasActiveFilters,
    setSearch,
    setStatus,
    setOs,
    setManufacturer,
    setSort,
    setPage,
    setPageSize,
    clearFilters,
    refresh,
  } = useDevices();

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Available manufacturers extracted dynamically from known dataset
  const manufacturerOptions = useMemo(
    () => ['ALL', 'Dell Inc.', 'Apple', 'Lenovo', 'HP Inc.', 'Framework', 'Microsoft Corporation'],
    []
  );

  const handleSortClick = (field: DeviceSortField) => {
    setSort(field);
  };

  const renderSortIndicator = (field: DeviceSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400" />
    );
  };

  const getStatusBadge = (devStatus: string) => {
    const s = devStatus.toUpperCase();
    if (s === 'ONLINE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
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
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Offline
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-blue-500/30 bg-blue-500/10 text-blue-400">
        <Clock className="w-3 h-3 text-blue-400" />
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">Devices</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage and monitor organization endpoints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-1.5"
            title="Refresh Fleet Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Sync</span>
          </Button>

          <Button
            onClick={() => setShowEnrollModal(true)}
            className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white gap-1.5 shadow-sm shadow-blue-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Enroll Device</span>
          </Button>
        </div>
      </div>

      {/* Fleet KPI Metric Bar (Derived dynamically from data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Devices
              </span>
              <span className="text-xl font-bold text-slate-100 mt-0.5 block">
                {metrics.totalDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300">
              <Server className="w-4 h-4 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        {/* Online */}
        <Card
          onClick={() => setStatus(status === 'ONLINE' ? 'ALL' : 'ONLINE')}
          className={`cursor-pointer transition-all border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 ${
            status === 'ONLINE' ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
                Online
              </span>
              <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
                {metrics.onlineDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Offline */}
        <Card
          onClick={() => setStatus(status === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
          className={`cursor-pointer transition-all border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 ${
            status === 'OFFLINE' ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
                Offline
              </span>
              <span className="text-xl font-bold text-amber-400 mt-0.5 block">
                {metrics.offlineDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card
          onClick={() => setStatus(status === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`cursor-pointer transition-all border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 ${
            status === 'PENDING' ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''
          }`}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">
                Pending
              </span>
              <span className="text-xl font-bold text-blue-400 mt-0.5 block">
                {metrics.pendingDevices}
              </span>
            </div>
            <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise Device Management Toolbar */}
      <Card className="border-slate-800/90 bg-slate-900/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by device name, hostname, serial number, IP..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-400 text-[11px]">Status:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer py-1 font-medium"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-200">All Statuses</option>
                  <option value="ONLINE" className="bg-slate-900 text-emerald-400">Online</option>
                  <option value="OFFLINE" className="bg-slate-900 text-amber-400">Offline</option>
                  <option value="PENDING" className="bg-slate-900 text-blue-400">Pending</option>
                </select>
              </div>

              {/* OS Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs">
                <span className="text-slate-400 text-[11px]">OS:</span>
                <select
                  value={os}
                  onChange={(e) => setOs(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer py-1 font-medium"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-200">All OS</option>
                  <option value="Windows" className="bg-slate-900 text-slate-200">Windows</option>
                  <option value="macOS" className="bg-slate-900 text-slate-200">macOS</option>
                  <option value="Linux" className="bg-slate-900 text-slate-200">Linux</option>
                </select>
              </div>

              {/* More Filters Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 gap-1.5 ${
                  manufacturer !== 'ALL' || showMoreFilters ? 'border-blue-500/40 text-blue-400' : ''
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {manufacturer !== 'ALL' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Expandable Secondary Filters (e.g. Manufacturer & Sort Order) */}
          {showMoreFilters && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Manufacturer:</span>
                <select
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  {manufacturerOptions.map((mfr) => (
                    <option key={mfr} value={mfr} className="bg-slate-900 text-slate-200">
                      {mfr === 'ALL' ? 'All Manufacturers' : mfr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSort(e.target.value as DeviceSortField)}
                  className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="lastSeenAt" className="bg-slate-900 text-slate-200">Last Seen</option>
                  <option value="deviceName" className="bg-slate-900 text-slate-200">Device Name</option>
                  <option value="status" className="bg-slate-900 text-slate-200">Status</option>
                  <option value="os" className="bg-slate-900 text-slate-200">Operating System</option>
                  <option value="registeredAt" className="bg-slate-900 text-slate-200">Registered Date</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSort(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-7 px-2 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 gap-1"
                >
                  {sortOrder === 'asc' ? (
                    <>
                      <ArrowUp className="w-3 h-3 text-blue-400" />
                      <span>Asc</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3 h-3 text-blue-400" />
                      <span>Desc</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                Active Filters:
              </span>

              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  Search: &quot;{search}&quot;
                  <button onClick={() => setSearch('')} className="hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {status !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  Status: {status}
                  <button onClick={() => setStatus('ALL')} className="hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {os !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  OS: {os}
                  <button onClick={() => setOs('ALL')} className="hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {manufacturer !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  Mfr: {manufacturer}
                  <button onClick={() => setManufacturer('ALL')} className="hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={clearFilters}
                className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-medium ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {error && !loading && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-8 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Unable to load devices</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="text-xs border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-lg border border-slate-800/90 bg-slate-900/40 overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 animate-pulse">
            <div className="h-4 w-48 bg-slate-800 rounded" />
          </div>
          <div className="divide-y divide-slate-800/80 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-1/4">
                  <div className="w-8 h-8 rounded-lg bg-slate-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-3/4 bg-slate-800 rounded" />
                    <div className="h-2.5 w-1/2 bg-slate-800/60 rounded" />
                  </div>
                </div>
                <div className="h-4 w-24 bg-slate-800 rounded" />
                <div className="h-4 w-16 bg-slate-800 rounded" />
                <div className="h-4 w-24 bg-slate-800 rounded hidden md:block" />
                <div className="h-4 w-20 bg-slate-800 rounded hidden sm:block" />
                <div className="h-7 w-20 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && devices.length === 0 && (
        <Card className="border-slate-800/80 bg-slate-900/30">
          <CardContent className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/60">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200">No devices found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No organization endpoints matched the current search and filter combination.'
                : 'No endpoints have been enrolled in this organization yet.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      {!loading && !error && devices.length > 0 && (
        <div className="rounded-lg border border-slate-800/90 bg-slate-900/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/90 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
                  {/* Device Header */}
                  <th
                    onClick={() => handleSortClick('deviceName')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Device / Hostname</span>
                      {renderSortIndicator('deviceName')}
                    </div>
                  </th>

                  {/* OS Header */}
                  <th
                    onClick={() => handleSortClick('os')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Operating System</span>
                      {renderSortIndicator('os')}
                    </div>
                  </th>

                  {/* Status Header */}
                  <th
                    onClick={() => handleSortClick('status')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>

                  {/* IP Address Header */}
                  <th className="py-3 px-4 hidden md:table-cell">
                    <span>IP Address</span>
                  </th>

                  {/* Last Seen Header */}
                  <th
                    onClick={() => handleSortClick('lastSeenAt')}
                    className="py-3 px-4 group cursor-pointer hover:text-slate-200 transition-colors"
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
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {devices.map((device) => {
                  const visual = getOsVisual(device.os);
                  return (
                    <tr
                      key={device.id}
                      onClick={() => navigate(`/devices/${device.id}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Device & Hostname */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-colors shrink-0">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                                {device.deviceName}
                              </span>
                              {device.model && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 hidden xl:inline">
                                  {device.model}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400 truncate">
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
                          <div className="text-[11px] text-slate-400 font-mono">
                            {device.osVersion}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(device.status)}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="font-mono text-[11px] text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
                          {device.ipAddress || '—'}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="text-slate-200 font-medium block">
                            {formatRelativeTime(device.lastSeenAt)}
                          </span>
                          {device.lastSeenAt && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {new Date(device.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Agent Version */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="font-mono text-[11px] text-slate-400">
                          {device.agentVersion || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/devices/${device.id}`)}
                          className="h-7 px-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 border-t border-slate-800/90 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range Counter */}
            <div className="text-slate-400">
              Showing{' '}
              <span className="font-medium text-slate-200">
                {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}
              </span>
              –
              <span className="font-medium text-slate-200">
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{' '}
              of <span className="font-medium text-slate-200">{pagination.total}</span> endpoints
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mr-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 focus:outline-none"
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
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="h-7 px-2 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                <span>Prev</span>
              </Button>

              {/* Page number buttons */}
              <div className="flex items-center gap-1">
                {[...Array(pagination.totalPages)].map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        page === pNum
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="h-7 px-2 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Device Modal Dialog (Staged UX Placeholder) */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Enroll New Endpoint</h3>
                  <p className="text-xs text-slate-400">Provision agent authorization credentials</p>
                </div>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-blue-400">
                <Clock className="w-4 h-4" />
                <span>Agent Enrollment Pipeline (Staged)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                The agent token generator and automated bootstrap installers for Windows (MSI), macOS (PKG), and Linux (Bash/systemd daemon) are currently being staged in the backend pipeline.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-300 block uppercase tracking-wider text-[10px]">
                Available Platform Installers
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  <span className="font-semibold text-slate-200 block">Windows</span>
                  <span className="text-[10px] font-mono mt-0.5 block">.msi / .ps1</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  <span className="font-semibold text-slate-200 block">macOS</span>
                  <span className="text-[10px] font-mono mt-0.5 block">.pkg / mobileconfig</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  <span className="font-semibold text-slate-200 block">Linux</span>
                  <span className="text-[10px] font-mono mt-0.5 block">.deb / systemd</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEnrollModal(false)}
                className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
