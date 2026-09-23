# Security

## Principles

1. **Defense in depth**: Multiple layers of security
2. **Least privilege**: Users and agents get minimum required permissions
3. **No trust boundaries violated**: Multi-tenant isolation is absolute
4. **Secure by default**: Sensible defaults, explicit opt-in for risky features
5. **Audit everything**: All significant actions are logged

## Authentication

### User Authentication
- Passwords hashed with Argon2id (preferred) or bcrypt
- JWT tokens with configurable expiry
- Password minimum 8 characters
- Failed login attempts logged

### Agent Authentication
- Enrollment tokens for initial registration (one-time use)
- JWT tokens for ongoing communication
- Tokens stored in Windows Credential Manager (not plaintext files)
- Token rotation supported

## Authorization

### Role Hierarchy
```
SUPER_ADMIN ──▶ Full system access
ORG_ADMIN   ──▶ Full organization access
IT_ADMIN    ──▶ Device and policy management
OPERATOR    ──▶ View devices, execute commands
VIEWER      ──▶ Read-only access
```

### Enforcement
- All authorization checks performed server-side
- Frontend role checks are UX only, not security
- Organization ID extracted from JWT on every request

## Data Protection

### In Transit
- HTTPS required in production
- TLS 1.2+ only

### At Rest
- Passwords never stored in plaintext
- Agent tokens stored as hashes in database
- Sensitive config via environment variables

### In Code
- No secrets committed to Git
- `.env` files excluded via `.gitignore`
- No credentials in source code

## Command Safety

- Only allow-listed commands can be executed
- No arbitrary shell command execution
- Destructive actions (lock, restart, shutdown) require `confirmed: true` in the request —
  enforced server-side, not only in the UI
- Commands have configurable timeout
- All command executions are audit-logged

## API Security

- Input validation on all endpoints (Zod schemas)
- Rate limiting (planned)
- CORS configured per environment
- Secure HTTP headers
- No stack traces in production error responses

## Audit Logging

All significant actions are recorded:
- Authentication events (login, logout, failures)
- Device registration
- Policy changes
- Command execution
- User management
- Configuration changes

Audit logs are append-only from the application perspective.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | Secret for JWT signing (min 16 chars) | Yes |
| JWT_EXPIRY | Token expiry (default: 24h) | No |
| AGENT_ENROLLMENT_SECRET | Secret for enrollment tokens | Yes |
| CORS_ORIGIN | Allowed CORS origin | Yes |
| API_PORT | Backend port (default: 3001) | No |
| NODE_ENV | Environment (development/production/test) | No |
