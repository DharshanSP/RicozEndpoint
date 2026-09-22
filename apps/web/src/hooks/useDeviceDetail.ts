import { useState, useEffect, useCallback } from 'react';
import { Device } from '../types/device';
import { getDeviceById } from '../lib/api/devicesApi';

interface UseDeviceDetailResult {
  device: Device | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom React hook for fetching single device details by ID or serial number.
 */
export function useDeviceDetail(deviceId: string | undefined): UseDeviceDetailResult {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevice = useCallback(async () => {
    if (!deviceId) {
      setLoading(false);
      setError('No device identifier provided.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const detail = await getDeviceById(deviceId);
      if (detail && detail.overview) {
        setDevice({
          ...detail.overview,
          organizationId: (detail.overview as unknown as { organizationId?: string }).organizationId ?? '',
          hardware: detail.hardware,
          software: detail.software,
          policies: detail.policies,
          complianceResults: detail.compliance,
          commands: detail.commands,
        });
      } else {
        setError(`Device '${deviceId}' not found.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading device details.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  const refresh = async () => {
    await fetchDevice();
  };

  return {
    device,
    loading,
    error,
    refresh,
  };
}
