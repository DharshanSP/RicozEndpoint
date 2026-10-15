-- AlterTable
ALTER TABLE "device_patches" ADD COLUMN     "needsReboot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "patches" ADD COLUMN     "cveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cvssScore" DOUBLE PRECISION,
ADD COLUMN     "cvssVector" TEXT;
