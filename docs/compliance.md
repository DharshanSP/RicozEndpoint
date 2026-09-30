# Compliance

RicozEndpoint evaluates endpoints against organizational policies on every agent heartbeat and
records the outcome as a `ComplianceResult`. Violations raise `COMPLIANCE_VIOLATION` alerts that
appear in the Alerts console.

## Evaluation Model

```
Heartbeat (with security telemetry)
        │
        ▼
┌───────────────────────────────┐
│  gather effective policies    │
│  (direct + via device groups) │
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  evaluate each policy         │
│  against device state         │
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  write ComplianceResult      │
│  (dedup, replace stale rows)  │
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  raise COMPLIANCE_VIOLATION   │
│  alert (deduplicated)          │
└───────────────────────────────┘
```

## Policy Types

| Policy type        | Evaluated settings                                                            |
| ------------------ | ----------------------------------------------------------------------------- |
| `SECURITY`         | `firewallRequired` → device `firewallEnabled`; `antivirusRequired` → device `antivirusEnabled` |
| `COMPLIANCE`       | `minOsVersion` / `minAgentVersion` → semver-aware comparison of device fields |

`CONFIGURATION` policies are delivered to the agent but are not scored for compliance.

## Effective Policy Resolution

A device's effective policies are the union of:

1. **Direct assignments** — `PolicyAssignment` rows where `deviceId` matches.
2. **Group assignments** — `PolicyAssignment` rows whose `groupId` matches a group the device
   belongs to (`DeviceGroupMember`).

Policies are deduplicated by id, and only `isActive: true` policies are applied. Assignments
carry a `priority`; the agent receives the joined policy settings with the highest priority
winning on conflict.

## Results & Versioning

- One `ComplianceResult` is written per evaluated policy.
- Policy-generated results have a `ruleId` of **null** and are tagged in `reason` with a
  marker `__ricoz_policy__<policyId>` so stale rows can be garbage-collected on the next run.
- Effective status (`complianceStatus` on `Device`) reflects the newest evaluation.

## Violation Alerts

A `COMPLIANCE_VIOLATION` alert is created for every non-compliant policy. Alerts are
deduplicated so a persistent violation does not spam the queue: an `OPEN` alert with the same
organization, device, type (`COMPLIANCE_VIOLATION`) and message is reused instead of creating a
duplicate.

## Frontend

- **Compliance page** (`/compliance`): fleet score, compliant/non-compliant device counts,
  failed-command count, per-rule pass rates, and the non-compliant device list.
- **Device detail** → *Compliance* tab: per-policy results for a single device.

See `apps/api/src/modules/compliance/compliance.service.ts` for the reference implementation.