-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "settingsJson" JSONB NOT NULL DEFAULT '{}';