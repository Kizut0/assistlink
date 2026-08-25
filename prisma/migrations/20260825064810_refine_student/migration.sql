/*
  Warnings:

  - You are about to drop the `EventRegistration` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_studentId_fkey";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "gpa" DOUBLE PRECISION,
ADD COLUMN     "resumeText" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "workHoursPerWeek" INTEGER;

-- DropTable
DROP TABLE "EventRegistration";
