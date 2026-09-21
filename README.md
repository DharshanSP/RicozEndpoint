# RicozEndpoint

Enterprise endpoint management platform for managing, monitoring, and securing devices from a centralized dashboard.

## Features

- Device registration and management
- Hardware and software inventory collection
- Real-time device status monitoring
- Policy management and compliance evaluation
- Remote command execution (allow-listed actions)
- Multi-tenant architecture
- Role-based access control
- Comprehensive audit logging

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Fastify, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Agent**: C# Windows Service (.NET 8.0)

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
- [Development Guide](docs/development.md)
- [Windows Agent](agents/windows/README.md)

## Development

```bash
pnpm dev:api     # Backend at http://localhost:3001
pnpm dev:web     # Frontend at http://localhost:5173
pnpm build       # Build all packages
pnpm lint        # Lint all packages
```

## License

Proprietary - All rights reserved.
