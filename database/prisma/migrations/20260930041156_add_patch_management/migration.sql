-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";

-- CreateTable
CREATE TABLE "patches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kbNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'IMPORTANT',
    "category" TEXT NOT NULL DEFAULT 'Security Updates',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "releaseDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_patches" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "patchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "installedAt" TIMESTAMP(3),
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_patches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patches_organizationId_idx" ON "patches"("organizationId");

-- CreateIndex
CREATE INDEX "patches_organizationId_severity_idx" ON "patches"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "patches_organizationId_status_idx" ON "patches"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "patches_organizationId_kbNumber_key" ON "patches"("organizationId", "kbNumber");

-- CreateIndex
CREATE INDEX "device_patches_deviceId_idx" ON "device_patches"("deviceId");

-- CreateIndex
CREATE INDEX "device_patches_patchId_idx" ON "device_patches"("patchId");

-- CreateIndex
CREATE INDEX "device_patches_status_idx" ON "device_patches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "device_patches_deviceId_patchId_key" ON "device_patches"("deviceId", "patchId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patches" ADD CONSTRAINT "patches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patches" ADD CONSTRAINT "patches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_patches" ADD CONSTRAINT "device_patches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_patches" ADD CONSTRAINT "device_patches_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
