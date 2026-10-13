-- Hot-path indexes for lookups that previously fell back to a sequential scan.
-- Hand-written to mirror the @@index entries added to schema.prisma, using
-- Prisma's default naming convention (<table>_<columns>_idx).

-- Compliance rollups aggregate stored results by rule (dashboard controls card,
-- device compliance tab). ComplianceResult.ruleId is nullable, so this index
-- also serves "results without a rule".
CREATE INDEX IF NOT EXISTS "compliance_results_ruleId_idx" ON "compliance_results"("ruleId");

-- Device -> group membership. The composite unique (groupId, deviceId) is led by
-- groupId and cannot serve deviceId-only lookups.
CREATE INDEX IF NOT EXISTS "device_group_members_deviceId_idx" ON "device_group_members"("deviceId");

-- Commands are always listed and drained per organization (queue, history).
CREATE INDEX IF NOT EXISTS "commands_organizationId_idx" ON "commands"("organizationId");

-- Alert de-duplication looks up the most recent alert for a fingerprint before
-- deciding whether to raise or bump an existing one.
CREATE INDEX IF NOT EXISTS "alerts_dedupKey_idx" ON "alerts"("dedupKey");
