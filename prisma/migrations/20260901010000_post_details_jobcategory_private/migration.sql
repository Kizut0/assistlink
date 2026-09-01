-- Handbook Phase 03 (Tasks 18/19): the post body field is named `details`, and
-- posts carry a job category (RA/TA) and a private flag.

-- 1. Task 19 names the body field `details`.
ALTER TABLE "Post" RENAME COLUMN "content" TO "details";

-- 2. JobCategory was declared in schema.prisma but never created in the DB,
--    because no field referenced it until now.
CREATE TYPE "JobCategory" AS ENUM ('RA', 'TA');

-- 3. Add jobCategory as nullable, backfill existing rows, then enforce NOT NULL,
--    so a table that already has posts migrates cleanly.
ALTER TABLE "Post" ADD COLUMN "jobCategory" "JobCategory";
UPDATE "Post" SET "jobCategory" = 'RA' WHERE "jobCategory" IS NULL;
ALTER TABLE "Post" ALTER COLUMN "jobCategory" SET NOT NULL;

-- 4. Task 18 lists only non-private posts.
ALTER TABLE "Post" ADD COLUMN "private" BOOLEAN NOT NULL DEFAULT false;
