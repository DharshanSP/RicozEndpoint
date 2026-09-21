# Database

## Overview

RicozEndpoint uses PostgreSQL with Prisma ORM. The database supports multi-tenant architecture with organization-level data isolation.

## ER Diagram (Simplified)

```
Organization ──┬── User
               ├── Device ──┬── DeviceHardware
               │            ├── DeviceSoftware
               │            ├── DeviceHeartbeat
               │            ├── Command
               │            ├── Alert
               │            └── PolicyAssignment
               ├── Policy ── PolicyAssignment
               ├── DeviceGroup ── DeviceGroupMember
               ├── Application ── Deployment
               ├── AuditLog
               └── AgentToken
```

## Key Models

### Organization
Top-level tenant. All data scoped to an organization.

### User
Admin/operator accounts. Role determines permission level.

### Device
Managed endpoint. Status derived from heartbeat freshness.

### DeviceHardware
Latest hardware inventory snapshot for a device.

### DeviceSoftware
All installed software entries for a device.

### Policy
Configuration rules assigned to devices/groups.

### Command
Remote action queued for a device. Lifecycle: PENDING → SENT → RUNNING → SUCCESS/FAILED.

### ComplianceResult
Evaluation result of a compliance rule against a device.

### AuditLog
Append-only record of significant system actions.

## Migrations

```bash
# Create a migration
pnpm db:migrate -- --name description_of_change

# Apply pending migrations
pnpm --filter @ricoz/database prisma migrate deploy

# Reset database (dev only)
pnpm db:reset

# Seed database
pnpm db:seed
```

## Seed Data

Development seed includes:
- 1 organization (Ricoz Demo Organization)
- 3 users (admin, operator, viewer)
- 5 demo devices with hardware and software
- 1 security policy
- 1 audit log entry
