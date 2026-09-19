-- AlterTable
ALTER TABLE "Plans" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "features" SET DEFAULT ARRAY[]::TEXT[];
