-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "website" TEXT,
    "employeeCountEstimate" TEXT,
    "opportunityScore" REAL NOT NULL DEFAULT 0,
    "scoreBreakdownJson" TEXT NOT NULL DEFAULT '[]',
    "useCase" TEXT,
    "useCaseRationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "whyJson" TEXT NOT NULL DEFAULT '[]',
    "firstDiscoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL,
    "runId" TEXT,
    "discoveryMode" TEXT NOT NULL DEFAULT 'demo'
);
INSERT INTO "new_Prospect" ("companyName", "country", "dedupeKey", "employeeCountEstimate", "firstDiscoveredAt", "id", "lastUpdatedAt", "opportunityScore", "runId", "scoreBreakdownJson", "status", "useCase", "useCaseRationale", "vertical", "website", "whyJson") SELECT "companyName", "country", "dedupeKey", "employeeCountEstimate", "firstDiscoveredAt", "id", "lastUpdatedAt", "opportunityScore", "runId", "scoreBreakdownJson", "status", "useCase", "useCaseRationale", "vertical", "website", "whyJson" FROM "Prospect";
DROP TABLE "Prospect";
ALTER TABLE "new_Prospect" RENAME TO "Prospect";
CREATE UNIQUE INDEX "Prospect_dedupeKey_key" ON "Prospect"("dedupeKey");
CREATE INDEX "Prospect_country_vertical_idx" ON "Prospect"("country", "vertical");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
