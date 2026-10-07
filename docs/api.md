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
| POST | /api/auth/register | Register a new organization + ORG_ADMIN account | public (toggle: `ALLOW_PUBLIC_SIGNUP`) |
| POST | /api/auth/login | Login with credentials | public |
| POST | /api/auth/logout | Record a logout event | any |
| GET | /api/auth/me | Get current user | any |
| POST | /api/auth/refresh | Refresh session token | any |
| POST | /api/auth/change-password | Change own password | any |

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
| POST | /api/users | Create user (only roles below your own) | ORG_ADMIN |
| PATCH | /api/users/:id | Update user / change role (audited as `USER_ROLE_CHANGED`) | ORG_ADMIN |
| POST | /api/users/:id/reset-password | Administratively reset password | ORG_ADMIN |
| DELETE | /api/users/:id | Delete user (blocked for self + last admin) | ORG_ADMIN |

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
`REFRESH_INVENTORY`, `SYNC_POLICY`, `INSTALL_PATCH`, `INSTALL_APPLICATION`,
`UNINSTALL_APPLICATION`, `LOCK_DEVICE`, `RESTART_DEVICE`, `SHUTDOWN_DEVICE`. Destructive
types (`LOCK_DEVICE`, `RESTART_DEVICE`, `SHUTDOWN_DEVICE`) **require `confirmed: true`**
and fail with a validation error otherwise. `INSTALL_APPLICATION` **requires
`params.installerUrl`** and `UNINSTALL_APPLICATION` **requires `params.name`**.

Commands are created with status `QUEUED`; the agent receives them (together with their
`params`) on its next heartbeat or via `GET /api/agent/commands/pending`, and reports back
`COMPLETED` / `FAILED`.

## Patches

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/patches | List catalog with coverage + fleet summary (filter: severity, status, search, page, limit) | VIEWER |
| GET | /api/patches/:id | Get a patch with per-device install state | VIEWER |
| GET | /api/patches/device/:id | Get every catalog patch alongside its state on one device | VIEWER |
| POST | /api/patches | Add a patch to the catalog | IT_ADMIN |
| PATCH | /api/patches/:id | Update metadata or approval status | IT_ADMIN |
| POST | /api/patches/:id/deploy | Queue `INSTALL_PATCH` on devices missing the patch | IT_ADMIN |

Create body: `{ kbNumber, title, description?, severity?, category?, releaseDate?, status? }`
where `kbNumber` must match `KB1234567` (it is upper-cased) and `severity` is one of
`CRITICAL` / `IMPORTANT` / `OPTIONAL`.

Deploy body: `{ deviceIds?, confirmed? }` — **`confirmed: true` is required**. Omitting
`deviceIds` targets every device in the patch's organization; otherwise the ids must all
belong to that organization. Devices that already have the patch, or that already have an
install in flight, are skipped and counted in the response.

Agents report installed KBs on every telemetry heartbeat, which upserts the catalog
(`PATCH_CREATED` implicitly) and the device's `INSTALLED` / `MISSING` state.

## Software

| Method | Endpoint | Description | Min. role |
|--------|----------|-------------|-----------|
| GET | /api/software | Aggregate software catalog (filter: search, sortBy, sortOrder, page, limit) | VIEWER |
| GET | /api/software/deployments | Deployment history with application, device and requester (filter: status, action, applicationId, deviceId, page, limit) | VIEWER |
| POST | /api/software/deploy | Queue an install or uninstall on a device or device group | IT_ADMIN |

Catalog items carry `id`, `name`, `publisher`, `deviceCount`, `versions[]`,
`latestVersion` and `installerUrl`. `installerUrl` is the package registered for the
managed application of that name (empty until a deployment has stored one); `id` is the
managed application id when it exists, otherwise a stable `name::publisher` key.

Deploy body:

```json
{
  "name": "7-Zip",
  "version": "24.08",
  "publisher": "Igor Pavlov",
  "installerUrl": "https://example.com/7z2408-x64.msi",
  "silentArgs": "/S",
  "targetType": "DEVICE",
  "targetId": "<device-uuid>",
  "action": "INSTALL",
  "confirmed": true
}
```

- **`confirmed: true` is required.**
- `targetType` is `DEVICE` or `GROUP`; `targetId` is the device or group id. A group with
  no members is rejected with `400`.
- `action` is `INSTALL` or `UNINSTALL`.
- For `INSTALL`, `installerUrl` must be an `http(s)` URL unless the managed application
  already stores one; it is required to bootstrap a new application.
- The managed `Application` row is matched by name inside the target organization (or by
  `applicationId`) and created/updated as part of the request.
- One `Deployment` row and one linked `QUEUED` command (`INSTALL_APPLICATION` or
  `UNINSTALL_APPLICATION`) are created per target device. Devices that already have the
  same action for the same application in flight are skipped and reported as
  `skippedInFlight`.
- The command `params` carry `installerUrl` (install only), `name`, `version`,
  `silentArgs`, `publisher`, `deploymentId` and `applicationId`.
- When the agent reports the command result, the linked deployment moves to `COMPLETED`
  or `FAILED` (with `errorMessage`). Requests are audited as `SOFTWARE_DEPLOY_REQUESTED`.

Agent behaviour: `INSTALL_APPLICATION` downloads the package to `%TEMP%\ricoz-deploy` and
runs it silently (`.msi` via `msiexec /qn /norestart`, `.msu` via `wusa`, `.exe` with the
supplied `silentArgs`); other package types fail with a clear message.
`UNINSTALL_APPLICATION` looks the product up by its registered `DisplayName` and removes
it through `msiexec /x` (MSI) or its registered `UninstallString`.

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