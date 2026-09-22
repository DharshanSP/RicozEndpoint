-- CreateTable
CREATE TABLE "enrollment_tokens" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_tokens_tokenHash_key" ON "enrollment_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "enrollment_tokens_organizationId_idx" ON "enrollment_tokens"("organizationId");

-- CreateIndex
CREATE INDEX "enrollment_tokens_tokenHash_idx" ON "enrollment_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
