-- Add composite indexes for device activity + audit filtering
CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_resourceId_timestamp_idx" ON "audit_logs"("organizationId", "resourceId", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_action_timestamp_idx" ON "audit_logs"("organizationId", "action", "timestamp");

