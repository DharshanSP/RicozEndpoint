-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "isDemoSeed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isDemoAccount" BOOLEAN NOT NULL DEFAULT false;
