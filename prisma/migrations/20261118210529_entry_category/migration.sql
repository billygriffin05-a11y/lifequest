-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionIcon" TEXT NOT NULL,
    "actionCategory" TEXT NOT NULL DEFAULT 'Other',
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
INSERT INTO "new_PointEntry" ("actionIcon", "actionId", "actionName", "createdAt", "honourDelta", "id", "idempotencyKey", "kind", "occurredAt", "occurredOn", "reversesEntryId", "updatedByDevice", "xpDelta") SELECT "actionIcon", "actionId", "actionName", "createdAt", "honourDelta", "id", "idempotencyKey", "kind", "occurredAt", "occurredOn", "reversesEntryId", "updatedByDevice", "xpDelta" FROM "PointEntry";
DROP TABLE "PointEntry";
ALTER TABLE "new_PointEntry" RENAME TO "PointEntry";
CREATE UNIQUE INDEX "PointEntry_idempotencyKey_key" ON "PointEntry"("idempotencyKey");
CREATE UNIQUE INDEX "PointEntry_reversesEntryId_key" ON "PointEntry"("reversesEntryId");
CREATE INDEX "PointEntry_occurredOn_idx" ON "PointEntry"("occurredOn");
CREATE INDEX "PointEntry_actionId_idx" ON "PointEntry"("actionId");
CREATE INDEX "PointEntry_actionCategory_idx" ON "PointEntry"("actionCategory");
-- Backfill: existing entries take their action's current category (best available snapshot).
UPDATE "PointEntry" SET "actionCategory" = (
    SELECT "category" FROM "PointAction" WHERE "PointAction"."id" = "PointEntry"."actionId"
) WHERE EXISTS (SELECT 1 FROM "PointAction" WHERE "PointAction"."id" = "PointEntry"."actionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
