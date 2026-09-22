import { DashboardTelemetryData } from '../../types/dashboard';
import { fetchApi } from '../api';

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
 *     "complianceScore": number,
 *     "openAlertsCount": number,
 *     "criticalAlertsCount": number,
 *     "warningAlertsCount": number,
 *     "osDistribution": [
 *       { "name": string, "count": number, "percentage": number, "color": string }
 *     ],
 *     "complianceControls": [
 *       { "name": string, "compliantCount": number, "total": number, "status": "Compliant" | "At Risk" }
 *     ],
 *     "activeAlerts": [
 *       { "id": string, "severity": "critical" | "warning" | "info", "title": string, "hostname": string, "ipAddress": string, "time": string, "category": string }
 *     ],
 *     "recentEvents": [
 *       { "id": string, "type": string, "description": string, "actor": string, "time": string, "status": "success" | "warning" | "info" | "error" }
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
