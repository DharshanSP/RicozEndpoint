-- AlterTable
ALTER TABLE "commands" ADD COLUMN     "patchId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- CreateIndex
CREATE INDEX "commands_patchId_idx" ON "commands"("patchId");
