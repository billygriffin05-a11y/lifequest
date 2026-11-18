-- CreateTable
CREATE TABLE "PointAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByDevice" TEXT NOT NULL DEFAULT 'pc'
);

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionIcon" TEXT NOT NULL,
    "honourDelta" INTEGER NOT NULL,
    "xpDelta" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "reversesEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByDevice" TEXT NOT NULL DEFAULT 'pc',
    CONSTRAINT "PointEntry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "PointAction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PointAction_kind_archivedAt_idx" ON "PointAction"("kind", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_idempotencyKey_key" ON "PointEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_reversesEntryId_key" ON "PointEntry"("reversesEntryId");

-- CreateIndex
CREATE INDEX "PointEntry_occurredOn_idx" ON "PointEntry"("occurredOn");

-- CreateIndex
CREATE INDEX "PointEntry_actionId_idx" ON "PointEntry"("actionId");
