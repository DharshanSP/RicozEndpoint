-- Separate the acknowledge note from the resolution note.
-- Backfill: rows currently ACKNOWLEDGED whose note landed in resolvedNote
-- (the route wrote it there before this column existed) keep their text.
ALTER TABLE "alerts" ADD COLUMN "acknowledgedNote" TEXT;

UPDATE "alerts"
SET "acknowledgedNote" = "resolvedNote"
WHERE "status" = 'ACKNOWLEDGED' AND "resolvedNote" IS NOT NULL;
