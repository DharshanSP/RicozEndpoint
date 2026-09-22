import { useState, useEffect, useCallback } from 'react';
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
 * Manages fetching, caching, loading state, error handling, and manual refresh triggers.
 *
 * @param timeRange - Selected telemetry timeframe ('24h' | '7d' | '30d')
 */
export function useDashboardData(timeRange: '24h' | '7d' | '30d' = '24h'): UseDashboardDataResult {
  const [data, setData] = useState<DashboardTelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getDashboardData(timeRange);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve telemetry data from service.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
