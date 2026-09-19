-- AlterTable
ALTER TABLE "homework" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "country" TEXT,
ADD COLUMN     "fcmToken" TEXT DEFAULT '',
ADD COLUMN     "nationality" TEXT;
