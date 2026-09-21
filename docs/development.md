# Development Guide

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose (for PostgreSQL)
- .NET 8.0 SDK (for Windows Agent, optional in Phase 1)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Seed development data

```bash
pnpm db:seed
```

### 6. Start development servers

```bash
# Start both API and Web
pnpm dev

# Or individually
pnpm dev:api    # Backend on http://localhost:3001
pnpm dev:web    # Frontend on http://localhost:5173
```

## Project Structure

```
RicozEndpoint/
├── apps/
│   ├── web/           # React frontend
│   └── api/           # Fastify backend
├── agents/
│   └── windows/       # C# Windows agent
├── packages/
│   ├── shared-types/  # TypeScript types
│   ├── validation/    # Zod schemas
│   └── config/        # Shared config
├── database/
│   └── prisma/        # Schema, migrations, seed
├── docs/              # Documentation
└── scripts/           # Build/deploy scripts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm format` | Format code with Prettier |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:reset` | Reset database |

## Development Workflow

1. Create a feature branch
2. Make changes
3. Run `pnpm lint` and `pnpm build` to verify
4. Run tests if applicable
5. Create a pull request

## Debugging

### Backend
- Pino logs with pretty printing in development
- Swagger UI at http://localhost:3001/docs

### Frontend
- React DevTools
- Vite HMR for instant feedback

### Database
- Prisma Studio: `pnpm db:studio`
