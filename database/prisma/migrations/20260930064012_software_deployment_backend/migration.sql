/*
  Warnings:

  - Added the required column `organizationId` to the `deployments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "commands" ADD COLUMN     "deploymentId" TEXT;

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "action" TEXT NOT NULL DEFAULT 'INSTALL',
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "requestedBy" TEXT;

-- CreateIndex
CREATE INDEX "commands_deploymentId_idx" ON "commands"("deploymentId");

-- CreateIndex
CREATE INDEX "deployments_organizationId_idx" ON "deployments"("organizationId");

-- CreateIndex
CREATE INDEX "deployments_deviceId_idx" ON "deployments"("deviceId");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
