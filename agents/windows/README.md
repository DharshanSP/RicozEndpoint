# RicozEndpoint Windows Agent

## Overview

The Windows Agent is a Windows Service that runs on managed endpoints and communicates with the RicozEndpoint backend API.

## Architecture

```
┌─────────────────────────────────────┐
│      Windows Agent Service          │
├─────────────────────────────────────┤
│  Registration Module                │
│  Heartbeat Module (30s interval)    │
│  Hardware Inventory Collector       │
│  Software Inventory Collector       │
│  Policy Sync Module                 │
│  Command Executor (allow-listed)    │
│  Local Logger                       │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│      RicozEndpoint Backend API      │
└─────────────────────────────────────┘
```

## Registration Flow

1. Agent reads enrollment token from configuration
2. Agent collects system information (hostname, serial number, OS)
3. Agent sends `POST /api/agent/register` with enrollment token and system info
4. Backend validates enrollment token, creates Device and AgentToken records
5. Agent receives back a deviceId and JWT token
6. Agent stores credentials securely in Windows Credential Manager

## Heartbeat

- Interval: 30 seconds (configurable)
- Endpoint: `POST /api/agent/heartbeat`
- Updates `lastSeenAt` on the device record
- Backend derives status: ONLINE (< 2min), OFFLINE (>= 2min)

## Inventory Collection

### Hardware
- Uses WMI queries and PowerShell commands
- Collects: CPU, RAM, disk, BIOS, manufacturer, model, serial number
- Endpoint: `POST /api/agent/inventory/hardware`

### Software
- Reads from Windows Registry (Uninstall key)
- Normalizes and deduplicates entries
- Endpoint: `POST /api/agent/inventory/software`

## Command Execution

Only allow-listed commands are supported:

| Command | Description |
|---------|-------------|
| REFRESH_INVENTORY | Re-collects hardware and software inventory |
| SYNC_POLICY | Pulls latest policy assignments from backend |
| LOCK_DEVICE | Locks the Windows workstation |
| RESTART_DEVICE | Initiates a system restart |
| SHUTDOWN_DEVICE | Initiates a system shutdown |

## Security

- All communication over HTTPS
- Tokens stored in Windows Credential Manager
- No arbitrary shell execution
- Commands validated against allow-list
- Command timeout after configurable period

## Build Requirements

- .NET 8.0 SDK or later
- Windows SDK
- Visual Studio 2022 or `dotnet` CLI

## Build

```bash
dotnet build
```

## Install

```powershell
# Run as Administrator
sc create RicozEndpointAgent binPath="C:\Path\To\RicozEndpoint.Agent.exe" start=auto
sc start RicozEndpointAgent
```

## TODO (Phase 5+)

- [ ] Implement Windows Service lifecycle
- [ ] Implement WMI hardware collection
- [ ] Implement registry-based software inventory
- [ ] Implement heartbeat loop
- [ ] Implement command polling and execution
- [ ] Windows Credential Manager integration
- [ ] MSI installer package
- [ ] Auto-update mechanism
