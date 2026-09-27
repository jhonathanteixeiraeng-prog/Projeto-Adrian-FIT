-- Exercise names were unique across all trainers, so a trainer couldn't use a name another trainer's
-- private library already had (audit A16). Now unique per library: (personalId, name). Existing names
-- are all distinct, so the new index can't fail.
DROP INDEX IF EXISTS "Exercise_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Exercise_personalId_name_key" ON "Exercise"("personalId", "name");
