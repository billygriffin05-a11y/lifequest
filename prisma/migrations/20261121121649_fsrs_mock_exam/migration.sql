-- AlterTable
ALTER TABLE "CardReview" ADD COLUMN "grade" INTEGER;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "difficulty" REAL;
ALTER TABLE "Flashcard" ADD COLUMN "lastReviewOn" TEXT;
ALTER TABLE "Flashcard" ADD COLUMN "stability" REAL;

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "takenOn" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "byTopic" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
