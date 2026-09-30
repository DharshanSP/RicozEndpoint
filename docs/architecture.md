# Architecture

## System Overview

RicozEndpoint is an enterprise endpoint management platform that enables IT administrators to manage, monitor, and secure Windows (and eventually macOS/Linux) devices from a centralized web dashboard.

## High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Dashboard │────▶│   Backend API   │◀────│  Windows Agent  │
│   (React/Vite)  │     │   (Fastify)     │     │  (C# Service)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  PostgreSQL │
                          │  Database   │
                          └─────────────┘
```

## Components

### Frontend (apps/web)
- **Framework**: React 19 with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query for server state
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts

### Backend (apps/api)
- **Framework**: Fastify with TypeScript
- **Database**: Prisma ORM + PostgreSQL
- **Auth**: JWT with bcrypt/argon2 password hashing
- **API Docs**: Swagger/OpenAPI via @fastify/swagger
- **Logging**: Pino structured logging

### Agent
- **Reference agent (`apps/agent`)**: TypeScript service — device registration, hardware/
  software/security inventory, heartbeats, policy fetch, command polling/execution.
- **Native agent (`agents/windows`)**: C# (.NET 8.0) Windows Service — see
  [`agents/windows/README.md`](../agents/windows/README.md).

### Shared Packages
- **@ricoz/shared-types**: TypeScript enums, interfaces, and types
- **@ricoz/validation**: Zod validation schemas
- **@ricoz/types** / **database** (Prisma): generated client + migrations

## Functional Modules (apps/api)

| Module | Route prefix | Responsibilities |
| ------ | ------------ | ---------------- |
| auth | /api/auth | Login, current user, JWT issuance |
| users | /api/users | User CRUD (org-scoped) |
| devices | /api/devices | Device registry, inventory, activity |
| dashboard | /api/dashboard | Fleet KPIs (devices, compliance, alerts, commands) |
| enrollment | /api/enrollment-tokens, /api/enroll | One-time tokens, agent registration |
| agent | /api/agent | Heartbeat, security telemetry, policy fetch, command polling |
| policies | /api/policies | Policy CRUD + device/group assignment |
| compliance | (service, invoked on heartbeat) | Evaluates policies, writes ComplianceResult, raises alerts |
| commands | /api/commands | Command create/list (allow-listed types, confirm flag) |
| alerts | /api/alerts | Alert list/resolve for compliance and operator feedback |

See [compliance.md](compliance.md) and [agent.md](agent.md) for module details.

## Multi-Tenancy

Every tenant-owned entity contains `organizationId`. All API queries enforce organization isolation. The backend middleware extracts the organization from the JWT token.

### Data Isolation

```
Organization A ─┬─ Users
                ├─ Devices
                ├─ Policies
                └─ Audit Logs

Organization B ─┬─ Users
                ├─ Devices
                ├─ Policies
                └─ Audit Logs
```

Cross-organization access is blocked at the middleware level.

## Security Model

1. **Authentication**: JWT tokens with configurable expiry
2. **Authorization**: Role-based (SUPER_ADMIN > ORG_ADMIN > IT_ADMIN > OPERATOR > VIEWER)
3. **Tenant Isolation**: Organization ID enforced on all queries
4. **Agent Auth**: Enrollment tokens for registration, JWT for ongoing communication
5. **Command Safety**: Allow-listed commands only, no arbitrary shell execution
6. **Audit Trail**: All significant actions logged with actor, timestamp, and metadata

## API Design

Consistent response format:
```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

Error format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-facing message"
  }
}
```

## Data Flow: Device Management

```
Agent Registration:
  Agent ──POST /api/agent/register──▶ Backend ──▶ Device + AgentToken created

Heartbeat:
  Agent ──POST /api/agent/heartbeat──▶ Backend ──▶ lastSeenAt updated

Inventory:
  Agent ──POST /api/agent/inventory/hardware──▶ Backend ──▶ DeviceHardware upserted
  Agent ──POST /api/agent/inventory/software──▶ Backend ──▶ DeviceSoftware upserted

Commands:
  Admin ──POST /api/commands──▶ Backend ──▶ Command created (confirm required for LOCK/RESTART/SHUTDOWN)
  Agent ──GET /api/agent/commands/pending──▶ Backend ──▶ Pending commands returned
  Agent ──POST /api/agent/commands/:id/result──▶ Backend ──▶ Command status updated
```

## Data Flow: Policy & Compliance

```
Policy Management:
  Admin ──POST /api/policies──▶ Backend ──▶ Policy created (typed: SECURITY/COMPLIANCE/CONFIGURATION)
  Admin ──POST /api/policies/:id/assign──▶ Backend ──▶ PolicyAssignment (deviceIds / groupIds, priority)

Policy Delivery:
  Admin ──POST /api/commands { type: SYNC_POLICY }──▶ Agent ──GET /api/agent/policies──▶ Merged active policies
  Heartbeat ──▶ ComplianceService ──▶ ComplianceResult table + complianceStatus on Device

Compliance:
  Heartbeat (security telemetry) ──▶ evaluate effective policies ──▶ write results ──▶ raise
  COMPLIANCE_VIOLATION alert (deduplicated) ──▶ visible on /api/dashboard and /api/alerts
```
