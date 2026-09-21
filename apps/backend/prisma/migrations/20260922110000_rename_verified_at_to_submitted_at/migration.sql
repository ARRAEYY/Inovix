-- INO-P1-29: rename StudentProfile.verifiedAt → submittedAt.
--
-- The previous column name implied the profile was verified by a college
-- directory or admin — but onboarding just stamps `new Date()` when the
-- student submits the form, with no actual verification step. Renaming
-- to `submittedAt` makes the semantics match the implementation, so any
-- future code that wants to gate on "verified" doesn't accidentally
-- trust an unverified timestamp.
--
-- Both SQLite 3.25.0+ (2018) and all supported Postgres versions
-- support `ALTER TABLE ... RENAME COLUMN`. No data is lost — the column
-- keeps its existing value, just under the new name.

ALTER TABLE "StudentProfile" RENAME COLUMN "verifiedAt" TO "submittedAt";
