import { DashboardTelemetryData } from '../../types/dashboard';
import { API_BASE_URL, API_BASE_URL_MISCONFIGURED, fetchApi } from '../api';

/**
 * ============================================================================
 * BACKEND API CONTRACT SPECIFICATION (For Dharshan)
 * ============================================================================
 *
 * Endpoint: GET /api/dashboard
 * Query Params: ?range=24h | 7d | 30d (optional, defaults to 24h)
 * Headers: Authorization: Bearer <jwt_token>
 *
 * Expected JSON Response Shape:
 * {
 *   "success": true,
 *   "data": {
 *     "totalDevices": number,
 *     "onlineDevices": number,
 *     "offlineDevices": number,
 *     "pendingEnrollment": number,
 *     "complianceScore": number,            // 0-100; 100 when nothing evaluated
 *     "compliantDevices": number,
 *     "nonCompliantDevices": number,
 *     "untestedDevices": number,
 *     "openAlertsCount": number,            // org-wide unresolved total (all time, ignores ?range)
 *     "criticalAlertsCount": number,
 *     "warningAlertsCount": number,
 *     "failedActionsCount": number,         // commands with status FAILED, all types, all time
 *     "patchSummary": {                  // catalog approval + failed installs, all time
 *       "total": number, "pending": number, "approved": number,
 *       "deployed": number, "failedInstalls": number
 *     },
 *     "osDistribution": [
 *       { "name": string, "count": number, "percentage": number, "color": string }
 *     ],
 *     "complianceControls": [
 *       { "name": string, "compliantCount": number, "total": number, "status": "Compliant" | "At Risk" | "Not Evaluated" }
 *     ],
 *     "activeAlerts": [                     // latest 10, windowed by ?range
 *       { "id": string, "severity": "critical" | "warning" | "info", "title": string, "hostname": string, "ipAddress": string, "time": string, "category": string }
 *     ],
 *     "recentEvents": [                     // latest 10, windowed by ?range
 *       { "id": string, "type": string, "description": string, "actor": string, "time": string, "status": "success" | "warning" | "error" }
 *     ]
 *   }
 * }
 * ============================================================================
 */

export interface DashboardApiResponse {
  success: boolean;
  data?: DashboardTelemetryData;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fetches the system admin dashboard telemetry and operational summary.
 *
 * @param timeRange - Selected telemetry timeframe ('24h' | '7d' | '30d')
 * @returns Promise resolving to the dashboard telemetry dataset
 */
export async function getDashboardData(timeRange: string = '24h'): Promise<DashboardApiResponse> {
  return fetchApi<DashboardTelemetryData>(
    `/dashboard${timeRange ? `?range=${encodeURIComponent(timeRange)}` : ''}`
  );
}

export interface SystemHealth {
  status: string;
  database?: string;
  timestamp: string;
  uptime: number;
  version?: string;
}

/** Unauthenticated liveness/readiness probe used by the dashboard status panel.
 *
 * NOTE: GET /api/health returns a BARE object (no {success,data} envelope) so
 * orchestrators can consume it directly — it must NOT go through fetchApi,
 * which only understands the envelope. It may also answer 503 when degraded;
 * the body shape is identical, so parse it either way.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  if (API_BASE_URL_MISCONFIGURED) {
    throw new Error('API base URL is not configured for this deployment.');
  }
  const res = await fetch(`${API_BASE_URL}/health`);
  let payload: SystemHealth | null = null;
  try {
    payload = (await res.json()) as SystemHealth;
  } catch {
    payload = null;
  }
  if (!payload?.status) {
    throw new Error(`Health probe failed (HTTP ${res.status})`);
  }
  return payload;
}
