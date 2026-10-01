# RicozEndpoint

Enterprise endpoint management platform for managing, monitoring, and securing devices from a centralized dashboard.

## Features

- Device registration and management
- Hardware and software inventory collection
- Real-time device status monitoring
- Policy management (SECURITY / COMPLIANCE / CONFIGURATION) with device + group assignment
- Compliance evaluation on agent heartbeat, with auto-generated violation alerts
- Remote command execution (allow-listed actions, confirmed destructive commands)
- Multi-tenant architecture
- Role-based access control
- Comprehensive audit logging

## Feature Matrix

| Feature | WEB | API | AGENT |
| ------- | --- | --- | ----- |
| Device list / detail / inventory / activity | ✅ | ✅ | — |
| Dashboard KPIs (compliance, commands, alerts) | ✅ | ✅ | — |
| Enrollment token management | ✅ | ✅ | — |
| Policy CRUD + assignment | ✅ | ✅ | — |
| Compliance scoring & violation alerts | ✅ | ✅ | — |
| Alerts list + resolve | ✅ | ✅ | — |
| Commands list + issue (confirm for destructive) | ✅ | ✅ | — |
| Hardware/software/security inventory | — | ✅ | ✅ |
| Heartbeat + policy fetch + command execution | — | ✅ | ✅ |

## Role Matrix

| Role | View | Devices | Policies | Commands | Alerts | Users |
| ---- | ---- | ------- | -------- | -------- | ------ | ----- |
| SUPER_ADMIN | ✅ all orgs | ✅ | ✅ | ✅ | ✅ | ✅ |
| ORG_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| IT_ADMIN | ✅ | ✅ | ✅ (create) | ✅ resolve | ✅ | list |
| OPERATOR | ✅ | view | view | legacy | view | — |
| VIEWER | ✅ | view | view | view | view | — |

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Fastify, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Agent**: TypeScript agent (`apps/agent`), downloadable Windows EXE, and C# Windows Service (`agents/windows`)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Setup database
cp .env.example .env
pnpm db:migrate
pnpm db:seed

# Start development
pnpm dev
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Compliance](docs/compliance.md)
- [Agent](docs/agent.md)
- [Development Guide](docs/development.md)
- [Windows Agent](agents/windows/README.md)

## Development

```bash
pnpm dev:api     # Backend at http://localhost:3001
pnpm dev:web     # Frontend at http://localhost:5173
pnpm build       # Build all packages
pnpm lint        # Lint all packages
```

## Windows Agent Enrollment

From **Fleet Devices**, select **Enroll Device** and follow the four-step guide:

1. Generate an enrollment token.
2. Download `RicozEndpointAgent.exe`.
3. Copy the EXE to the target Windows device and run it.
4. Paste the enrollment token when prompted.

The agent collects device inventory, enrolls the device, saves its agent credentials, and starts the heartbeat loop. The EXE is served from `apps/web/public/downloads/` and can be rebuilt with:

```bash
pnpm build:agent:exe
```

The executable reads `API_URL` from the Windows environment. Set it to the production API before launching the agent:

```powershell
$env:API_URL = "https://your-api-domain.example/api"
.\RicozEndpointAgent.exe
```

The current executable is unsigned. Windows SmartScreen may display a warning until it is signed with a production code-signing certificate.

## Production Deployment

The supported hosted layout is:

```text
Supabase PostgreSQL -> Railway API -> Vercel web application
```

### Supabase

Create a Supabase project and use its PostgreSQL connection string as `DATABASE_URL`. Run migrations from a trusted deployment environment:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @ricoz/database prisma migrate deploy
# Optional: pnpm db:seed
```

### Railway API

Create a Railway service from the repository root. Set the build command to:

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build:types && pnpm build:validation && pnpm build:api
```

Set the start command to:

```bash
pnpm --filter @ricoz/database exec prisma migrate deploy && pnpm --filter @ricoz/api start
```

Configure these Railway variables:

```env
DATABASE_URL=your_supabase_postgresql_url
JWT_SECRET=long-random-production-secret
JWT_EXPIRY=24h
AGENT_ENROLLMENT_SECRET=long-random-production-secret
CORS_ORIGIN=https://your-vercel-domain.vercel.app
API_PORT=3001
NODE_ENV=production
```

### Vercel web application

Import the repository into Vercel and set the root directory to `apps/web`.

```text
Build command: pnpm --filter @ricoz/web build
Output directory: dist
```

Set this Vercel variable before building:

```env
VITE_API_URL=https://your-railway-domain.up.railway.app/api
```

Configure a rewrite to `index.html` if direct refreshes of React Router routes return 404:

```json
{
	"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

After deployment, update Railway's `CORS_ORIGIN` with the final Vercel domain and redeploy the API. Rebuild the agent with the production API URL available to the target Windows environment before distributing it.

### Production checks

- Sign in through the Vercel URL.
- Confirm the web app can reach the Railway API.
- Generate an enrollment token and download the EXE.
- Run the EXE on a Windows device with `API_URL` set to Railway.
- Confirm the device appears in Fleet Devices and its heartbeat updates.

## License

Proprietary - All rights reserved.
