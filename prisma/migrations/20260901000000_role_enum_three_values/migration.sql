-- Handbook Task 10: Role has three values (PROFESSOR, ADMIN, STUDENT). FACULTY dropped.
-- Sorts after the 20260831000000_init baseline, so ordering is correct.
-- Postgres cannot drop an enum value in place — the type must be recreated,
-- and any existing FACULTY row must be re-homed first or the cast fails.

-- 1. Re-home any FACULTY users before the value disappears.
UPDATE "User" SET "role" = 'PROFESSOR' WHERE "role" = 'FACULTY';

-- 2. Swap the type.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('PROFESSOR', 'ADMIN', 'STUDENT');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
DROP TYPE "Role_old";
