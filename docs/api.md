# API Documentation

## Base URL

```
http://localhost:3001/api
```

## Swagger UI

Available at: `http://localhost:3001/docs`

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-facing error message"
  }
}
```

## Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with credentials |
| GET | /api/auth/me | Get current user |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |

### Agent (Phase 4+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/agent/register | Register a new device |
| POST | /api/agent/heartbeat | Send agent heartbeat |
| POST | /api/agent/inventory/hardware | Submit hardware inventory |
| POST | /api/agent/inventory/software | Submit software inventory |
| GET | /api/agent/policies | Get assigned policies |
| GET | /api/agent/commands | Poll for pending commands |
| POST | /api/agent/commands/:id/result | Submit command result |

### Devices (Phase 7+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/devices | List devices |
| GET | /api/devices/:id | Get device details |
| DELETE | /api/devices/:id | Remove device |
| POST | /api/devices/:id/commands | Create command |

### Policies (Phase 9+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/policies | List policies |
| POST | /api/policies | Create policy |
| GET | /api/policies/:id | Get policy |
| PUT | /api/policies/:id | Update policy |
| DELETE | /api/policies/:id | Delete policy |

## Authentication

Most endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Agent endpoints use agent-specific tokens obtained during registration.
