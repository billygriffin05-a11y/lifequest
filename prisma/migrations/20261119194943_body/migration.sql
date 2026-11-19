-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurredOn" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RunLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurredOn" TEXT NOT NULL,
    "distanceMetres" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WaterDay" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "glasses" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SleepLog" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "bedTime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "grams" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WorkoutSet_occurredOn_idx" ON "WorkoutSet"("occurredOn");

-- CreateIndex
CREATE INDEX "WorkoutSet_exercise_idx" ON "WorkoutSet"("exercise");

-- CreateIndex
CREATE INDEX "RunLog_occurredOn_idx" ON "RunLog"("occurredOn");
