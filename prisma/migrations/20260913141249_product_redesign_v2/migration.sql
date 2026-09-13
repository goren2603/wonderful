-- CreateTable
CREATE TABLE "SourcingModelEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidatesReviewed" INTEGER NOT NULL,
    "hiresAnalyzed" INTEGER NOT NULL,
    "trainSize" INTEGER NOT NULL,
    "holdoutSize" INTEGER NOT NULL,
    "kUsed" INTEGER NOT NULL,
    "v1Precision" REAL NOT NULL,
    "v2Precision" REAL NOT NULL,
    "improvementPct" REAL,
    "validationStatus" TEXT NOT NULL,
    "highPerformerDefinition" TEXT NOT NULL,
    "factorAuditJson" TEXT NOT NULL DEFAULT '[]'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "themeId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "baseline" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'STABLE',
    "aiExplanation" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("aiExplanation", "baseline", "companyId", "confidence", "createdAt", "evidenceCount", "id", "recommendedAction", "severity", "status", "themeId", "title", "trend", "type") SELECT "aiExplanation", "baseline", "companyId", "confidence", "createdAt", "evidenceCount", "id", "recommendedAction", "severity", "status", "themeId", "title", "trend", "type" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_companyId_idx" ON "Alert"("companyId");
CREATE TABLE "new_Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currentTitle" TEXT NOT NULL,
    "yearsExperience" REAL NOT NULL,
    "education" TEXT NOT NULL,
    "previousCompaniesJson" TEXT NOT NULL DEFAULT '[]',
    "startupExperience" BOOLEAN NOT NULL DEFAULT false,
    "eliteUniversity" BOOLEAN NOT NULL DEFAULT false,
    "priorLeadership" BOOLEAN NOT NULL DEFAULT false,
    "technicalDomain" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "originalSourcingScore" REAL NOT NULL,
    "isNewBatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Candidate" ("createdAt", "currentTitle", "education", "geography", "id", "name", "originalSourcingScore", "previousCompaniesJson", "startupExperience", "technicalDomain", "yearsExperience") SELECT "createdAt", "currentTitle", "education", "geography", "id", "name", "originalSourcingScore", "previousCompaniesJson", "startupExperience", "technicalDomain", "yearsExperience" FROM "Candidate";
DROP TABLE "Candidate";
ALTER TABLE "new_Candidate" RENAME TO "Candidate";
CREATE TABLE "new_DecisionMaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "confidence" REAL NOT NULL,
    "whyThisPerson" TEXT,
    "isReal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DecisionMaker_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DecisionMaker" ("confidence", "id", "linkedinUrl", "name", "prospectId", "title") SELECT "confidence", "id", "linkedinUrl", "name", "prospectId", "title" FROM "DecisionMaker";
DROP TABLE "DecisionMaker";
ALTER TABLE "new_DecisionMaker" RENAME TO "DecisionMaker";
CREATE INDEX "DecisionMaker_prospectId_idx" ON "DecisionMaker"("prospectId");
CREATE TABLE "new_OutreachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "decisionMakerId" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "sentAt" DATETIME,
    "replyNote" TEXT,
    "nextAction" TEXT,
    CONSTRAINT "OutreachMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachMessage_decisionMakerId_fkey" FOREIGN KEY ("decisionMakerId") REFERENCES "DecisionMaker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutreachMessage" ("angle", "approvedAt", "body", "channel", "createdAt", "id", "prospectId", "sentAt", "status", "subject") SELECT "angle", "approvedAt", "body", "channel", "createdAt", "id", "prospectId", "sentAt", "status", "subject" FROM "OutreachMessage";
DROP TABLE "OutreachMessage";
ALTER TABLE "new_OutreachMessage" RENAME TO "OutreachMessage";
CREATE INDEX "OutreachMessage_prospectId_idx" ON "OutreachMessage"("prospectId");
CREATE INDEX "OutreachMessage_decisionMakerId_idx" ON "OutreachMessage"("decisionMakerId");
CREATE TABLE "new_PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "retentionMonths" REAL,
    "managerRating" REAL,
    "promotionVelocityMonths" REAL,
    "stillEmployed" BOOLEAN NOT NULL DEFAULT true,
    "department" TEXT,
    "roleHiredInto" TEXT,
    "currentRole" TEXT,
    "promotions" INTEGER NOT NULL DEFAULT 0,
    "highPerformer" BOOLEAN NOT NULL DEFAULT false,
    "customMetricsJson" TEXT NOT NULL DEFAULT '{}',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PerformanceRecord" ("candidateId", "customMetricsJson", "id", "managerRating", "promotionVelocityMonths", "recordedAt", "retentionMonths") SELECT "candidateId", "customMetricsJson", "id", "managerRating", "promotionVelocityMonths", "recordedAt", "retentionMonths" FROM "PerformanceRecord";
DROP TABLE "PerformanceRecord";
ALTER TABLE "new_PerformanceRecord" RENAME TO "PerformanceRecord";
CREATE UNIQUE INDEX "PerformanceRecord_candidateId_key" ON "PerformanceRecord"("candidateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
