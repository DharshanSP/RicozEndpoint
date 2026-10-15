-- Backstop for alert de-duplication: at most one unresolved alert per
-- (organization, type, device, key). NULL device/key are normalized so
-- keyless scopes also collide instead of silently stacking.
-- The application still performs the fuzzy check-then-insert first; this
-- index turns a lost race into a P2002 conflict, which the writers translate
-- back into a dedup hit. Deploy check: if this fails, exact unresolved
-- duplicates already exist — list them with:
--   SELECT "organizationId", "type", COALESCE("deviceId",'-'), COALESCE("dedupKey",'-'), count(*)
--   FROM alerts WHERE status IN ('OPEN','ACKNOWLEDGED')
--   GROUP BY 1,2,3,4 HAVING count(*) > 1;
-- and resolve the duplicates before re-running.
CREATE UNIQUE INDEX "alerts_dedup_open_uniq"
  ON "alerts" (
    "organizationId",
    "type",
    (COALESCE("deviceId", '00000000-0000-0000-0000-000000000000')),
    (COALESCE("dedupKey", ''))
  )
  WHERE "status" IN ('OPEN', 'ACKNOWLEDGED');
