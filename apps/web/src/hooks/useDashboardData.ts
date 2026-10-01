import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardTelemetryData } from '../types/dashboard';
import { getDashboardData } from '../lib/api/dashboardApi';

interface UseDashboardDataResult {
  data: DashboardTelemetryData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom React hook for consuming dashboard telemetry data.
 * Backed by react-query so switching time ranges reuses cached responses and
 * the board polls for fresh telemetry while it is mounted.
 *
 * @param timeRange - Selected telemetry timeframe ('24h' | '7d' | '30d')
 */
export function useDashboardData(timeRange: '24h' | '7d' | '30d' = '24h'): UseDashboardDataResult {
  const query = useQuery({
    queryKey: ['dashboard', timeRange],
    queryFn: async (): Promise<DashboardTelemetryData> => {
      const res = await getDashboardData(timeRange);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to retrieve telemetry data from service.');
      }
      return res.data;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refresh,
  };
}
