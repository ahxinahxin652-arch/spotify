-- AlterTable
ALTER TABLE "music_libraries" ADD COLUMN "recentPlayedAt" DATETIME;

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN "cover" TEXT;
