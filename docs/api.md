# API Documentation

## Base URL

```
http://localhost:3001/api
```

## Swagger UI

Available at: `http://localhost:3001/docs`

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-facing error message"
  }
}
```

## Authentication

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| POST | /api/auth/login | Login with credentials | public |
| GET | /api/auth/me | Get current user | any |

Most endpoints require a `Authorization: Bearer <jwt>` header. All queries are scoped to the
authenticated user's organization (`SUPER_ADMIN` may bypass organization scope).

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |

## Users

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/users | List organization users | IT_ADMIN |
| POST | /api/users | Create user | ORG_ADMIN |
| PATCH | /api/users/:id | Update user | ORG_ADMIN |

## Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/devices | List devices (filter: q, status, complianceStatus, page, limit) |
| GET | /api/devices/:id | Get device details plus hardware/software summary |
| GET | /api/devices/:id/hardware | Hardware inventory |
| GET | /api/devices/:id/software | Software inventory |
| GET | /api/devices/:id/activity | Recent activity feed |

All device endpoints require authentication (any role).

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Device, compliance, alert and command KPIs |

Returns `compliantDevices`, `nonCompliantDevices`, `failedActionsCount`, device status counts,
recent devices, active alerts and recent commands.

## Enrollment

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/enrollment-tokens | List enrollment tokens | IT_ADMIN |
| POST | /api/enrollment-tokens | Create an enrollment token | IT_ADMIN |
| DELETE | /api/enrollment-tokens/:id | Revoke a token | IT_ADMIN |
| POST | /api/enroll | Agent registration with a one-time token | agent token |

## Agent

Agent endpoints use an agent JWT obtained during registration (`/api/enroll`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/agent/heartbeat | Send heartbeat + security telemetry; evaluates compliance |
| GET | /api/agent/policies | Get effective, active policies for the device |
| GET | /api/agent/commands/pending | Poll for pending commands |
| POST | /api/agent/commands/:id/result | Submit command result |

## Policies

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/policies | List policies (filter: type, q, includeAssignments, page, limit) | VIEWER |
| GET | /api/policies/:id | Get policy with assignment counts | VIEWER |
| POST | /api/policies | Create policy | IT_ADMIN |
| PUT | /api/policies/:id | Update policy | IT_ADMIN |
| DELETE | /api/policies/:id | Delete policy | IT_ADMIN |
| POST | /api/policies/:id/assign | Assign policy to devices / groups (deviceIds, groupIds) | IT_ADMIN |

Policy types: `SECURITY` (firewall/antivirus requirements), `COMPLIANCE` (min OS/agent
version), `CONFIGURATION` (policy JSON delivered to agent). See [compliance.md](compliance.md).

## Commands

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/commands | List commands (filter: deviceId, type, status, page, limit) | VIEWER |
| POST | /api/commands | Issue a command | IT_ADMIN |
| GET | /api/commands/:id | Get command details | VIEWER |

Command creation body: `{ deviceId, type, confirmed?, params? }`. Types:
`REFRESH_INVENTORY`, `SYNC_POLICY`, `LOCK_DEVICE`, `RESTART_DEVICE`, `SHUTDOWN_DEVICE`.
Destructive types (`LOCK_DEVICE`, `RESTART_DEVICE`, `SHUTDOWN_DEVICE`) **require
`confirmed: true`** and fail with a validation error otherwise.

## Alerts

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/alerts | List alerts (filter: status, severity, type, q, page, limit) | VIEWER |
| GET | /api/alerts/:id | Get alert details | VIEWER |
| POST | /api/alerts/:id/resolve | Resolve an open alert (note optional) | IT_ADMIN |

Alert types include `COMPLIANCE_VIOLATION` (auto-generated, deduplicated) and manual severity
levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

## Role Gates (RBAC)

| Role        | Typical access                                                        |
| ----------- | --------------------------------------------------------------------- |
| SUPER_ADMIN | Full system access, crosses organization boundaries                   |
| ORG_ADMIN   | Organization users + everything below                                 |
| IT_ADMIN    | Devices, policies, commands (create), enrollment tokens, alerts       |
| OPERATOR    | View + execute commands (legacy role)                                 |
| VIEWER      | Read-only access to devices, policies, commands, alerts, dashboard    |

Enforcement is server-side via `requireMinRole` on every protected route; frontend role checks
are UI only.