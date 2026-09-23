-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "type" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "antivirusEnabled" BOOLEAN,
ADD COLUMN     "firewallEnabled" BOOLEAN;

-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "policies_createdById_idx" ON "policies"("createdById");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
