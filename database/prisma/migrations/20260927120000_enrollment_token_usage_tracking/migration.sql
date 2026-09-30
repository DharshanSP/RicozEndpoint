-- AlterTable
ALTER TABLE "enrollment_tokens" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- AuditLog.actorId becomes nullable so system-initiated events (agent enrollment,
-- scheduled compliance evaluations) can be recorded without a human actor.
ALTER TABLE "audit_logs" ALTER COLUMN "actorId" DROP NOT NULL;
