# RicozEndpoint — Complete Usage Tutorial

This guide walks through setting up, configuring, and using the RicozEndpoint platform from first login to day-to-day operations.

---

## 1. Quick Start (5 minutes)

### Prerequisites
- Node.js 20+, pnpm 9+
- PostgreSQL 15+ (or use the provided Docker compose)
- Git

### Install & Run

```bash
# Clone and install
git clone https://github.com/DharshanSP/RicozEndpoint.git
cd RicozEndpoint
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Initialize database
pnpm db:migrate
pnpm db:seed

# Start development servers (API + Web)
pnpm dev
```

**Access:**
- Web UI: http://localhost:5173
- API: http://localhost:3001
- API Health: http://localhost:3001/health

### Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@ricoz.local | admin123 |
| Operator | operator@ricoz.local | operator123 |
| Viewer | viewer@ricoz.local | viewer123 |

> **Security:** Change all passwords immediately after first login. The seed creates a `Ricoz Demo Organization` — rename it in **Settings → Organization**.

---

## 2. Core Concepts

### Organizations
Multi-tenancy root. All devices, users, policies, and data belong to an organization. Super Admins manage organizations; Org Admins manage resources within theirs.

### Roles (RBAC)
| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full platform access, manage organizations, all org data |
| **ORG_ADMIN** | Manage users, settings, enrollment tokens within org |
| **IT_ADMIN** | Device groups, policies, commands, software deployment |
| **OPERATOR** | Remote actions (lock, refresh, sync), view dashboards |
| **VIEWER** | Read-only dashboards, reports, audit logs |

### Devices
Endpoints running the Ricoz agent. Statuses: `ONLINE`, `OFFLINE`, `PENDING` (awaiting enrollment), `NON_COMPLIANT`.

### Enrollment Tokens
One-time secrets generated in **Devices → Enrollment Tokens** to register agents securely.

---

## 3. First-Time Setup Checklist

1. **Login** as `admin@ricoz.local` / `admin123`
2. **Settings → Organization**
   - Rename organization
   - Configure defaults: heartbeat interval, offline timeout, retention policies
3. **Devices → Enrollment Tokens**
   - Create a token (name it, set expiry, optional device limit)
   - Copy the token — shown **once only**
4. **Install Agent** on a test machine
   - Windows: `msiexec /i ricoz-agent.msi ENROLLMENT_TOKEN=<token> API_URL=http://your-api:3001`
   - Linux: `sudo ./install.sh --token <token> --api http://your-api:3001`
5. **Verify** in **Devices** list — status should turn `ONLINE`
6. **Create a Policy** in **Security → Policies**
   - Type: Security / Configuration / Patch
   - Define settings (firewall, antivirus, password rules, etc.)
7. **Assign Policy** to device or device group
8. **Check Compliance** in **Security → Compliance**

---

## 4. Module Walkthroughs

### 4.1 Dashboard
Real-time overview:
- **Total Devices** — count by status
- **Compliance Score** — % devices passing all assigned policies
- **Open Alerts** — critical/warning/info counts
- **Failed Actions** — commands that errored in last 24h

### 4.2 Devices
**List** — filter by status, search by name/hostname/serial. Click a row for **Device Detail**:
- Hardware (CPU, RAM, storage)
- Installed software (version, publisher, install date)
- Policy assignments & compliance results
- Command history
- Audit trail for this device

**Actions** (IT_ADMIN+):
- `Refresh` — force check-in
- `Lock` — immediate screen lock
- `Sync` — full state sync
- `Restart` / `Shutdown` — **disabled on production** (safety)

### 4.3 Device Groups
Organize devices for bulk policy assignment.
1. **Create Group** — name, description
2. **Add Members** — select devices (multi-select)
3. **Assign Policy** — in Policy detail, choose group(s) under "Assign to Groups"
4. Groups show **member count** and **policy count** on list

### 4.4 Software Catalog
Aggregated view of all software across the fleet.
- **Name, Publisher, Device Count, Versions, Latest Version**
- Search by name/publisher
- Click a row → see which devices have it, versions distribution
- **Deploy** button → push install/uninstall to device or group (IT_ADMIN+)

### 4.5 Patch Management
Tracks missing OS/security patches per device (populated by agent scans).
- Agents report installed KBs on every telemetry heartbeat (`Get-HotFix`); those reports upsert the catalog and the device's install state
- Filter by severity (Critical / Important / Optional) and status (Pending / Approved / Deployed)
- Per-patch coverage: installed / failed / missing across the organization's devices, plus a fleet up-to-date percentage
- **Approve** moves a patch `PENDING → APPROVED`; **Deploy** (IT Admin+) queues an `INSTALL_PATCH` command on every device missing it and marks it `DEPLOYED`
- Devices already up to date, or with a command already in flight, are skipped and reported back
- Drill into a device: **Devices → detail → Patches** shows installed / missing / failed per KB
- Agents pull commands on their next heartbeat; installs run through the Windows Update Agent and never force a reboot

### 4.6 Policies (Security → Policies)
Create policy templates:
- **Security** — firewall, AV, encryption, password, lock timeout
- **Configuration** — registry, services, scheduled tasks
- **Patch** — auto-install rules, maintenance windows

**Assign** to individual devices or device groups. Priority resolves conflicts (higher wins).

### 4.7 Compliance (Security → Compliance)
Per-device, per-rule evaluation results.
- Rules: Disk Encryption, Firewall Active, EDR Running, Patches Current, AV Real-time, Auto-Lock
- Status: `COMPLIANT` / `NON_COMPLIANT` / `UNTESTED` (no evaluation yet)
- Reporting range: last 24h / 7d / 30d / all time — controls recompute over that window
- Drill into a device → see which policies and rules pass/fail with reasons
- **Re-evaluate** (IT Admin+) re-runs the engine fleet-wide without waiting for the next heartbeat

### 4.8 Alerts (Security → Alerts)
Agent- and policy-generated alerts.
- Severities: `CRITICAL`, `WARNING`, `INFO`
- Status: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`
- Actions: Acknowledge, Resolve, Add Note
- Filter by severity, status, device, time range

### 4.9 Audit Logs (Operations → Audit Logs)
Immutable trail of all privileged actions.
- Columns: Timestamp, Actor, Action, Resource, Resource ID, IP, Metadata
- Filters: date range, action type, actor email search, resource
- Export CSV for compliance reporting

### 4.10 Reports (Operations → Reports)
Pre-built and custom exports.
- **Devices CSV** — inventory snapshot
- **Software CSV** — installed apps across fleet
- **Compliance CSV** — rule results per device
- **Audit CSV** — filtered audit trail
- Schedule via cron (future) or manual download

### 4.11 Users (Admin → Users)
Manage organization members.
- **Create** — email, name, password, role
- **Edit** — role, active flag, password reset
- **Delete** — soft delete (retains audit trail)
- Super Admin can manage cross-org; Org Admin only own org

### 4.12 Settings (Admin → Settings)
Organization-level configuration (ORG_ADMIN+):
| Setting | Default | Description |
|---------|---------|-------------|
| Agent Heartbeat Interval | 60s | How often agent checks in |
| Offline Timeout | 15m | When to mark device OFFLINE |
| Alert Retention | 30d | Auto-purge resolved alerts |
| Audit Retention | 365d | Compliance retention |
| Default Policy Priority | 100 | Base priority for new policies |

---

## 5. Agent Enrollment Details

### Token Creation
```
POST /api/enrollment-tokens
{ "name": "Q3 Rollout", "expiresInDays": 30, "maxDevices": 50 }
→ { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### Agent Config (agent.toml / registry)
```toml
[server]
url = "https://api.yourdomain.com"
enrollment_token = "eyJhbGciOiJIUzI1NiIs..."

[agent]
heartbeat_interval = 60
log_level = "info"
```

### Supported Platforms
- Windows 10/11, Server 2019+ (MSI)
- Ubuntu 20.04+, Debian 11+, RHEL 8+ (deb/rpm/script)
- macOS 12+ (pkg, limited)

---

## 6. API Reference (Key Endpoints)

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/api/auth` | `POST /login`, `POST /refresh`, `GET /me` |
| Devices | `/api/devices` | `GET /`, `GET /:id`, `POST /:id/commands` |
| Device Groups | `/api/device-groups` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/members`, `DELETE /:id/members/:deviceId` |
| Policies | `/api/policies` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/assign` |
| Compliance | `/api/compliance` | `GET /`, `GET /device/:id`, `POST /evaluate` |
| Patches | `/api/patches` | `GET /`, `GET /:id`, `GET /device/:id`, `POST /`, `PATCH /:id`, `POST /:id/deploy` |
| Alerts | `/api/alerts` | `GET /`, `PATCH /:id/acknowledge`, `PATCH /:id/resolve` |
| Commands | `/api/commands` | `GET /`, `POST /` (create), `GET /:id` |
| Software | `/api/software` | `GET /` (catalog), `POST /deploy` |
| Audit Logs | `/api/audit-logs` | `GET /` (filters: page, limit, action, search, from, to) |
| Settings | `/api/settings` | `GET /`, `PUT /` |
| Users | `/api/users` | `GET /`, `POST /`, `PATCH /:id` |
| Enrollment | `/api/enrollment-tokens` | `GET /`, `POST /`, `DELETE /:id` |
| Dashboard | `/api/dashboard` | `GET /` |

**Auth:** All endpoints require `Authorization: Bearer <JWT>` header.

**Pagination:** `?page=1&limit=25` (default). Response: `{ success, data: { items, total, page, limit } }`.

---

## 7. Common Workflows

### Deploy a Security Policy to All Laptops
1. **Security → Policies → Create** → "Laptop Baseline" (Security type)
2. Configure: firewall=true, antivirus=true, autoLock=900, minPassLen=12
3. **Device Groups → Create Group** → "All Laptops"
4. Add members: filter devices by OS contains "Windows 10/11", select all
5. **Policy Detail → Assign** → select "All Laptops" group → priority 100
6. Devices pick up on next heartbeat (≤60s)

### Investigate a Compliance Failure
1. **Security → Compliance** → filter `NON_COMPLIANT`
2. Click device → see failed rule (e.g., "Firewall Active")
3. **Device Detail → Commands** → send `REFRESH` to re-evaluate
4. If persistent, **Devices → Device Detail → Audit Logs** → check recent policy assignments

### Onboard a New IT Operator
1. **Admin → Users → Create** → email, name, password, role=IT_ADMIN
2. Share credentials securely (password manager)
3. Operator logs in → sees Devices, Device Groups, Policies, Software, Commands
4. Operator **cannot** manage users, settings, enrollment tokens

### Generate Compliance Report for Audit
1. **Operations → Reports** → select "Compliance"
2. Filter date range, export CSV
3. Or **Operations → Audit Logs** → filter `COMPLIANCE_EVALUATED` → export CSV

---

## 8. Production Hardening Checklist

- [ ] **Change all default passwords** (admin, operator, viewer)
- [ ] **Rotate JWT_SECRET** in `.env` (32+ random chars)
- [ ] **Enable HTTPS** — terminate TLS at reverse proxy (nginx/Traefik/Caddy)
- [ ] **Set CORS_ORIGIN** to your exact domain(s)
- [ ] **Configure PostgreSQL** — dedicated user, restricted network access
- [ ] **Run `pnpm db:migrate deploy`** on prod DB (not `dev`)
- [ ] **Set `NODE_ENV=production`**
- [ ] **Disable demo seed** — `SKIP_DEMO_SEED=true pnpm db:seed`
- [ ] **Backup strategy** — daily PG dumps, test restores
- [ ] **Monitor** — API `/health`, agent heartbeat lag, disk space
- [ ] **Log aggregation** — ship API + agent logs to Loki/ELK

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Device stuck `PENDING` | Token invalid/expired | Regenerate token, reinstall agent |
| Device `OFFLINE` but running | Heartbeat interval / timeout mismatch | Check Settings → Agent Heartbeat / Offline Timeout |
| Policy not applying | Priority conflict or device not in group | Verify group membership, check policy priority |
| Login fails | Wrong org / password | Ensure user belongs to org; SUPER_ADMIN bypasses org scope |
| Commands fail | Agent version mismatch / offline | Agent must be ≥0.1.0 and ONLINE |
| Web shows blank page | Vite dev server not running / API URL wrong | Check `VITE_API_URL` in web `.env` |

---

## 10. Advanced: Custom Compliance Rules

Rules live in `ComplianceRule` table. Create via API or SQL:

```sql
INSERT INTO "ComplianceRule" (id, "organizationId", name, description, "ruleType", condition)
VALUES (gen_random_uuid(), '<org-id>', 'Custom: BitLocker on C:',
  'Verifies BitLocker encryption on system drive',
  'ENCRYPTION', '{"drive":"C:","encrypted":true}');
```

Agent evaluates `condition` against collected facts. Extend agent fact collectors for custom rules.

---

## 11. File Structure (for Developers)

```
├── apps/
│   ├── api/          # Fastify + Prisma backend
│   ├── web/          # React + Vite + TanStack Query frontend
│   └── agent/        # Go/Rust agent (separate repo)
├── packages/
│   ├── shared-types/ # TypeScript interfaces
│   └── validation/   # Zod schemas
├── database/
│   └── prisma/       # Schema, migrations, seed
└── docs/             # This tutorial + API, architecture, security
```

---

## 12. Support & Contributing

- **Issues:** https://github.com/DharshanSP/RicozEndpoint/issues
- **Discussions:** GitHub Discussions tab
- **Security:** Email security@ricoz.local (GPG key on repo)

---

*Last updated: 2026-09-27 | Version aligned with commit `a57112f`*