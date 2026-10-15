-- Composite hot-path indexes for the device inventory and alert list.
-- Single-column indexes on these tables already exist; the composites below
-- match the actual access patterns (org scope + status filter + ordering),
-- e.g. GET /api/devices, the offline sweeper, and GET /api/alerts.
-- NOTE: text `contains` search (LIKE '%…%') cannot use btree indexes; those
-- filters remain sequential scans inside one organization, which is
-- acceptable at fleet scale (add pg_trgm only if profiling demands it).
CREATE INDEX IF NOT EXISTS "devices_org_status_idx"
  ON "devices" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "devices_org_created_idx"
  ON "devices" ("organizationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "devices_org_registered_idx"
  ON "devices" ("organizationId", "registeredAt" DESC);

CREATE INDEX IF NOT EXISTS "devices_org_status_seen_idx"
  ON "devices" ("organizationId", "status", "lastSeenAt" DESC);

CREATE INDEX IF NOT EXISTS "alerts_org_status_created_idx"
  ON "alerts" ("organizationId", "status", "createdAt" DESC);
