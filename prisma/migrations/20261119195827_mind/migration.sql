-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "totalPages" INTEGER NOT NULL,
    "finishedOn" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReadingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "pages" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingLog_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deck" TEXT NOT NULL DEFAULT 'Security+',
    "topic" TEXT NOT NULL DEFAULT '',
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "dueOn" TEXT NOT NULL,
    "seedKey" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CardReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reflection" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "mood" INTEGER,
    "entry" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ReadingLog_bookId_idx" ON "ReadingLog"("bookId");

-- CreateIndex
CREATE INDEX "ReadingLog_day_idx" ON "ReadingLog"("day");

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_seedKey_key" ON "Flashcard"("seedKey");

-- CreateIndex
CREATE INDEX "Flashcard_dueOn_idx" ON "Flashcard"("dueOn");

-- CreateIndex
CREATE INDEX "CardReview_day_idx" ON "CardReview"("day");

-- CreateIndex
CREATE INDEX "FocusSession_day_idx" ON "FocusSession"("day");
