-- AlterTable
ALTER TABLE "PointAction" ADD COLUMN "weeklyTarget" INTEGER;

-- CreateTable
CREATE TABLE "DragonProfile" (
    "areaId" TEXT NOT NULL PRIMARY KEY,
    "customName" TEXT,
    "updatedAt" DATETIME NOT NULL
);
