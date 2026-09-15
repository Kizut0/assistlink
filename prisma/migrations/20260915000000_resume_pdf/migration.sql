ALTER TABLE "Student"
ADD COLUMN "resumePdf" BYTEA,
ADD COLUMN "resumeFileName" TEXT,
ADD COLUMN "resumeMimeType" TEXT,
ADD COLUMN "resumeSizeBytes" INTEGER,
ADD COLUMN "resumeUploadedAt" TIMESTAMP(3);
