-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedBy" TEXT,
ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "resolvedBy" TEXT,
ADD COLUMN     "resolvedNote" TEXT;

-- CreateIndex
CREATE INDEX "alerts_organizationId_type_status_idx" ON "alerts"("organizationId", "type", "status");
