import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelPatchDeploy,
  createPatch,
  deletePatch,
  deployPatch,
  getDevicePatches,
  getPatch,
  listPatches,
  retryPatch,
  updatePatch,
} from '../lib/api/patchesApi';
import type {
  CreatePatchPayload,
  DeployPatchPayload,
  DeployPatchResult,
  DevicePatchListResponse,
  PatchDetailResponse,
  PatchItem,
  PatchListQuery,
  PatchListResponse,
  UpdatePatchPayload,
} from '../types/patch';

/** Patch catalog page for the Patch Management screen. */
export function usePatchList(query: PatchListQuery = {}) {
  return useQuery({
    queryKey: ['patches', 'list', query],
    queryFn: (): Promise<PatchListResponse> => listPatches(query),
  });
}

/** Single patch with per-device coverage. */
export function usePatch(patchId: string | undefined) {
  return useQuery({
    queryKey: ['patches', 'detail', patchId],
    queryFn: (): Promise<PatchDetailResponse> => getPatch(patchId!),
    enabled: Boolean(patchId),
  });
}

/** Catalog state for one device (device detail view). */
export function useDevicePatches(deviceId: string | undefined) {
  return useQuery({
    queryKey: ['patches', 'device', deviceId],
    queryFn: (): Promise<DevicePatchListResponse> => getDevicePatches(deviceId!),
    enabled: Boolean(deviceId),
  });
}

/** Adds a catalog entry, then refreshes the list. */
export function useCreatePatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePatchPayload): Promise<PatchItem> => createPatch(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
    },
  });
}

/** Updates metadata or approval status, then refreshes the list. */
export function useUpdatePatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patchId, payload }: { patchId: string; payload: UpdatePatchPayload }) =>
      updatePatch(patchId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
    },
  });
}

/** Queues deployment commands, then refreshes list, detail and device views. */
export function useDeployPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      patchId,
      payload,
    }: {
      patchId: string;
      payload?: DeployPatchPayload;
    }): Promise<DeployPatchResult> => deployPatch(patchId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
      void queryClient.invalidateQueries({ queryKey: ['commands'] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Re-queues failed installs, then refreshes patch queries. */
export function useRetryPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patchId: string) => retryPatch(patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
      void queryClient.invalidateQueries({ queryKey: ['commands'] });
    },
  });
}

/** Cancels queued installs, then refreshes patch queries. */
export function useCancelPatchDeploy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patchId: string) => cancelPatchDeploy(patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
      void queryClient.invalidateQueries({ queryKey: ['commands'] });
    },
  });
}

/** Deletes a catalog entry, then refreshes the list. */
export function useDeletePatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patchId: string) => deletePatch(patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches'] });
    },
  });
}
