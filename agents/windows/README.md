# RicozEndpoint Windows Agent

## Overview

The Windows Agent runs on managed endpoints, communicates with the RicozEndpoint
backend API, and reports device hardware/software inventory and heartbeat status.

The agent is implemented as a cross-platform CLI application in **Node.js /
TypeScript** and lives in [`apps/agent`](../../apps/agent). This folder
(`agents/windows`) is the designated home for a future native .NET 8 Windows
Service build of the same agent.

## Quick Start (Node agent)

Requires Node.js 20+ and the workspace installed via pnpm.

```bash
cd apps/agent
cp .env.example .env   # set API_URL + ENROLLMENT_TOKEN
pnpm install
npx tsx src/index.ts
```

### Configuration (`.env`)

| Variable                | Default                                  | Description                             |
|-------------------------|------------------------------------------|-----------------------------------------|
| `API_URL`               | `http://localhost:3001/api`              | Backend base URL                        |
| `ENROLLMENT_TOKEN`      | *(required)*                             | One-time enrollment code                |
| `HEARTBEAT_INTERVAL_MS` | `30000`                                  | Heartbeat interval                      |
| `TELEMETRY_INTERVAL_MS` | `300000`                                 | Inventory (hardware/software) interval  |
| `AGENT_STATE_FILE`      | `%APPDATA%\RicozEndpoint\agent.json`     | Persisted device id + agent token       |

On first start the agent calls `POST /api/enroll` with the enrollment token and
system info, receives a `deviceId` and agent token, then stores them in the state
file. It runs a heartbeat loop and sends hardware/software telemetry on the
`TELEMETRY_INTERVAL_MS` cadence (or when a `REFRESH_INVENTORY` command arrives).

## Architecture

```
┌──────────────────────────────────┐
│  Agent CLI (apps/agent, Node/TS) │
├──────────────────────────────────┤
│  Enroll / state persistence      │
│  Heartbeat loop                  │
│  Hardware collector (PowerShell) │
│  Software collector (PowerShell) │
│  Command executor (allow-listed) │
└──────────────┬───────────────────┘
               │ HTTP/HTTPS
               ▼
┌──────────────────────────────────┐
│   RicozEndpoint Backend API      │
└──────────────────────────────────┘
```

## Registration Flow

1. Agent reads the enrollment token from `.env`
2. Agent collects hostname, serial number, OS (via PowerShell/CIM)
3. Agent sends `POST /api/enroll` with the enrollment token and system info
4. Backend validates the token, creates/reuses the `Device` and issues an agent token
5. Agent stores `deviceId` + agent token in the state file

## Heartbeat

- Endpoint: `POST /api/agent/heartbeat` (auth: `X-Agent-Token` header)
- Updates `lastSeenAt` on the device record; backend derives ONLINE (< 2 min) / OFFLINE
- Server returns pending commands to execute

## Inventory Collection

- **Hardware**: PowerShell CIM queries — CPU, RAM, storage, BIOS, manufacturer, model, serial
- **Software**: Windows registry Uninstall key via PowerShell, normalized and deduplicated
- Sent with the heartbeat as telemetry or on `REFRESH_INVENTORY`

## Command Execution

Only allow-listed commands are supported ([`apps/agent/src/commands.ts`](../../apps/agent/src/commands.ts)):

| Command            | Description                              |
|--------------------|------------------------------------------|
| `REFRESH_INVENTORY`| Re-collects hardware and software inventory |
| `SYNC_POLICY`      | Pulls latest policy assignments from backend |
| `LOCK`             | Locks the Windows workstation             |
| `RESTART`          | Schedules a system restart (10s)          |
| `SHUTDOWN`         | Schedules a system shutdown (10s)         |

Results are reported via `POST /api/agent/commands/:id/result`.

## Security

- Enrollment and agent tokens are stored server-side as SHA-256 hashes only
- Agent authenticates with an `X-Agent-Token` header; re-enrolling revokes prior tokens
- No arbitrary shell execution — commands validated against the allow-list

## API Contract (server side)

The agent talks to [`apps/api`](../../apps/api) routes:

- `POST /api/enroll` — one-time enrollment (public, token-gated)
- `POST /api/agent/heartbeat` — heartbeat + telemetry + pending commands
- `POST /api/agent/commands/:id/result` — report command outcome
- `GET /api/agent/commands/pending` — explicit pending-command pull

## Future Work (.NET Windows Service)

A production Windows Service build (installable via MSI, running as a service,
tokens in Windows Credential Manager, auto-update) would live under this folder:

- [ ] `RicozEndpoint.Agent` — service worker + collectors (WMI), `dotnet build`
- [ ] `RicozEndpoint.Service` — Windows service host, `sc create RicozEndpointAgent`
- [ ] MSI installer package
- [ ] Auto-update mechanism