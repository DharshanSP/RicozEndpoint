import { useState, useEffect, useCallback } from 'react';
import {
  Device,
  DeviceFilterParams,
  DevicePagination,
  DeviceFleetMetrics,
  DeviceSortField,
  SortOrder,
} from '../types/device';
import { getDevices } from '../lib/api/devicesApi';

interface UseDevicesResult {
  devices: Device[];
  pagination: DevicePagination;
  metrics: DeviceFleetMetrics;
  loading: boolean;
  error: string | null;
  // Filter state
  search: string;
  status: string;
  os: string;
  manufacturer: string;
  sortBy: DeviceSortField;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
  hasActiveFilters: boolean;
  // Handlers
  setSearch: (query: string) => void;
  setStatus: (status: string) => void;
  setOs: (os: string) => void;
  setManufacturer: (mfr: string) => void;
  setSort: (field: DeviceSortField, order?: SortOrder) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

const DEFAULT_PAGINATION: DevicePagination = {
  page: 1,
  limit: 10,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

const DEFAULT_METRICS: DeviceFleetMetrics = {
  totalDevices: 0,
  onlineDevices: 0,
  offlineDevices: 0,
  pendingDevices: 0,
};

/**
 * Custom React hook for managing device fleet list querying, filtering, sorting, and pagination.
 */
export function useDevices(initialParams: DeviceFilterParams = {}): UseDevicesResult {
  const [search, setSearchState] = useState<string>(initialParams.search || '');
  const [status, setStatusState] = useState<string>(initialParams.status || 'ALL');
  const [os, setOsState] = useState<string>(initialParams.os || 'ALL');
  const [manufacturer, setManufacturerState] = useState<string>(initialParams.manufacturer || 'ALL');
  const [sortBy, setSortByState] = useState<DeviceSortField>(initialParams.sortBy || 'lastSeenAt');
  const [sortOrder, setSortOrderState] = useState<SortOrder>(initialParams.sortOrder || 'desc');
  const [page, setPageState] = useState<number>(initialParams.page || 1);
  const [pageSize, setPageSizeState] = useState<number>(initialParams.pageSize || 10);

  const [devices, setDevices] = useState<Device[]>([]);
  const [pagination, setPagination] = useState<DevicePagination>(DEFAULT_PAGINATION);
  const [metrics, setMetrics] = useState<DeviceFleetMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const hasActiveFilters =
    search.trim() !== '' || status !== 'ALL' || os !== 'ALL' || manufacturer !== 'ALL';

  const fetchDeviceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getDevices({
        search,
        status,
        os,
        manufacturer,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });

      if (res.success && res.data) {
        const rawDevices = Array.isArray(res.data) ? res.data : [];
        setDevices(rawDevices as unknown as Device[]);
        if (res.pagination) {
          setPagination(res.pagination);
        }
        const total = res.pagination?.total ?? rawDevices.length;
        const online = rawDevices.filter((d) => d.status === 'ONLINE').length;
        const offline = rawDevices.filter((d) => d.status === 'OFFLINE').length;
        const pending = rawDevices.filter((d) => d.status !== 'ONLINE' && d.status !== 'OFFLINE').length;
        setMetrics({
          totalDevices: total,
          onlineDevices: online,
          offlineDevices: offline,
          pendingDevices: pending,
        });
      } else {
        setError(res.error?.message || 'Failed to retrieve endpoint inventory.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error retrieving endpoint inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, status, os, manufacturer, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  const setSearch = (query: string) => {
    setSearchState(query);
    setPageState(1); // Reset to first page on query change
  };

  const setStatus = (newStatus: string) => {
    setStatusState(newStatus);
    setPageState(1);
  };

  const setOs = (newOs: string) => {
    setOsState(newOs);
    setPageState(1);
  };

  const setManufacturer = (mfr: string) => {
    setManufacturerState(mfr);
    setPageState(1);
  };

  const setSort = (field: DeviceSortField, order?: SortOrder) => {
    if (sortBy === field && !order) {
      // Toggle order if clicking same field
      setSortOrderState((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortByState(field);
      setSortOrderState(order || (field === 'lastSeenAt' || field === 'registeredAt' ? 'desc' : 'asc'));
    }
    setPageState(1);
  };

  const setPage = (newPage: number) => {
    setPageState(newPage);
  };

  const setPageSize = (newSize: number) => {
    setPageSizeState(newSize);
    setPageState(1);
  };

  const clearFilters = () => {
    setSearchState('');
    setStatusState('ALL');
    setOsState('ALL');
    setManufacturerState('ALL');
    setPageState(1);
  };

  const refresh = async () => {
    await fetchDeviceData();
  };

  return {
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
  };
}
