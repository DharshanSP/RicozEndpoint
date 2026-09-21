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

### Agent (agents/windows)
- **Language**: C# (.NET 8.0)
- **Type**: Windows Service
- **Communication**: REST over HTTPS
- **Inventory**: WMI + Windows Registry
- **Storage**: Windows Credential Manager

### Shared Packages
- **@ricoz/shared-types**: TypeScript enums, interfaces, and types
- **@ricoz/validation**: Zod validation schemas

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
  Admin ──POST /api/devices/:id/commands──▶ Backend ──▶ Command created
  Agent ──GET /api/agent/commands──▶ Backend ──▶ Pending commands returned
  Agent ──POST /api/agent/commands/:id/result──▶ Backend ──▶ Command status updated
```
