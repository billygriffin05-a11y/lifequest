-- AlterTable
ALTER TABLE "DragonProfile" ADD COLUMN "path" TEXT;

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "weekStart" TEXT NOT NULL PRIMARY KEY,
    "win" TEXT NOT NULL DEFAULT '',
    "obstacle" TEXT NOT NULL DEFAULT '',
    "change" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
