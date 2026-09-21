-- INO-P1-28: collegeId is now globally unique.
-- Previously StudentProfile had @@unique([collegeId, fullName]) which
-- allowed the same college ID to be used by multiple students with
-- different name spellings. The schema now declares
-- `collegeId String @unique`, so each college ID maps to exactly one
-- student profile.
--
-- Migration steps:
--   1. Drop the composite unique index (StudentProfile_collegeId_fullName_key)
--   2. Drop the redundant plain index on collegeId (@unique creates its own)
--   3. Create the new unique index on collegeId alone
--
-- Production note: if the existing data contains duplicate collegeId values
-- (with different fullName), step 3 will FAIL with a unique constraint
-- violation. Before running this migration in production, audit for
-- duplicates:
--
--   SELECT collegeId, COUNT(*) AS n
--   FROM "StudentProfile"
--   GROUP BY collegeId
--   HAVING COUNT(*) > 1;
--
-- Resolve the duplicates manually (merge student records or correct
-- data entry errors) before re-attempting the migration.

-- DropIndex (composite unique — replaced by column-level @unique)
DROP INDEX IF EXISTS "StudentProfile_collegeId_fullName_key";

-- DropIndex (redundant plain index — @unique creates its own implicit index)
DROP INDEX IF EXISTS "StudentProfile_collegeId_idx";

-- CreateIndex (globally unique collegeId)
CREATE UNIQUE INDEX "StudentProfile_collegeId_key" ON "StudentProfile"("collegeId");
