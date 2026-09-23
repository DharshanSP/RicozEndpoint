# Agent

## Reference Agent (`@ricoz/agent`)

The TypeScript reference agent (`apps/agent`) implements the device-side protocol for the
RicozEndpoint backend. It is a lightweight Node/TS service designed to run on an endpoint host
behind the corporate firewall.

> A native Windows service implementation also exists — see
> [`agents/windows/README.md`](../agents/windows/README.md).

## Responsibilities

- Register a device with a one-time enrollment token
- Collect hardware, software, and security inventory
- Send periodic heartbeats with security telemetry
- Fetch its effective (actively assigned) policies
- Poll for and execute pending commands, then report results

## Lifecycle

```
Register ──▶ Authenticate ──▶ Loop
  │                            ├── heartbeat (security telemetry)
  │                            ├── sync policies (SYNC_POLICY command)
  │                            └── poll + run commands
```

1. **Register**: `POST /api/agent/register` with the enrollment token. The backend creates the
   device and returns an agent JWT.
2. **Heartbeat**: `POST /api/agent/heartbeat` includes reported security state (firewall,
   antivirus, OS/agent versions, bitlocker, disk encryption, last boot). The backend evaluates
   compliance and updates `lastSeenAt` / `complianceStatus`.
3. **Policies**: `GET /api/agent/policies` returns the device's effective active policies —
   settings are merged across direct and group assignments, highest `priority` wins.
   The `SYNC_POLICY` command triggers the agent to re-fetch immediately.
4. **Commands**: `GET /api/agent/commands` polls for pending commands; each executed command
   reports back via `POST /api/agent/commands/:id/result`.

## Configuration

Configuration is provided via environment variables:

| Variable              | Description                                    |
| --------------------- | ---------------------------------------------- |
| `API_URL`             | Backend base URL (e.g. `http://localhost:3001`) |
| `ENROLLMENT_TOKEN`    | One-time device enrollment token               |
| `DEVICE_ID`           | Existing device id (skips re-registration)     |
| `AGENT_ID`            | Existing agent id (skips re-registration)      |
| `AGENT_TOKEN`         | Agent JWT (persisted after registration)       |
| `INTERVAL_SECONDS`    | Heartbeat/poll interval (default 60)           |

## Running

```bash
pnpm --filter @ricoz/agent dev      # watch mode
pnpm --filter @ricoz/agent build   # compile to dist/
pnpm --filter @ricoz/agent start   # run compiled output
```

## Security

- Enrollment tokens are one-time use; subsequent calls use the agent JWT (keyed to
  `organizationId` context via `X-AgentToken` or agent JWT).
- Commands are allow-listed — the agent never executes arbitrary shell input.
- Destructive commands (`RESTART_DEVICE`, `SHUTDOWN_DEVICE`, `LOCK_DEVICE`) carry a
  `confirmed: true` flag enforced server-side on `POST /api/devices/:id/commands`.