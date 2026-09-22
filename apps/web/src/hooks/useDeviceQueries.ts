import { useQuery } from '@tanstack/react-query';
import {
  getDevice,
  getDeviceActivity,
  getDeviceHardware,
  getDeviceSoftware,
  listDevices,
  type DeviceListQuery,
} from '../lib/api/devicesApi';
import type {
  ActivityEvent,
  DeviceDetail,
  DeviceHardware,
  DeviceListData,
  DeviceSoftwareItem,
} from '../types/device';

function unwrap<T>(res: { data?: T; error?: { code: string; message: string } }): T {
  if (res.data === undefined) {
    throw new Error(res.error?.message ?? 'Request failed');
  }
  return res.data;
}

/** Paginated, filterable device list. */
export function useDeviceList(query: DeviceListQuery) {
  return useQuery({
    queryKey: ['devices', 'list', query],
    queryFn: async (): Promise<DeviceListData> => {
      const res = await listDevices(query);
      const devices = unwrap(res);
      if (!res.pagination) {
        throw new Error('Invalid device list response: missing pagination');
      }
      return { devices, pagination: res.pagination };
    },
  });
}

/** Full device detail including overview, hardware, software, policies, compliance, commands, activity. */
export function useDeviceDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['devices', 'detail', id],
    queryFn: async (): Promise<DeviceDetail> => unwrap(await getDevice(id ?? '')),
    enabled: !!id,
  });
}

/** Dedicated hardware inventory endpoint, fetched lazily when the Hardware tab is opened. */
export function useDeviceHardware(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['devices', 'hardware', id],
    queryFn: async (): Promise<DeviceHardware | null> => unwrap(await getDeviceHardware(id ?? '')),
    enabled: enabled && !!id,
  });
}

/** Dedicated software inventory endpoint, fetched lazily when the Software tab is opened. */
export function useDeviceSoftware(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['devices', 'software', id],
    queryFn: async (): Promise<DeviceSoftwareItem[]> => unwrap(await getDeviceSoftware(id ?? '')),
    enabled: enabled && !!id,
  });
}

/** Dedicated activity stream endpoint, fetched lazily when the Activity tab is opened. */
export function useDeviceActivity(id: string | undefined, enabled: boolean, limit = 20) {
  return useQuery({
    queryKey: ['devices', 'activity', id, limit],
    queryFn: async (): Promise<ActivityEvent[]> => unwrap(await getDeviceActivity(id ?? '', limit)),
    enabled: enabled && !!id,
  });
}