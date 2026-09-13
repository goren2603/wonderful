-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "entitiesFound" INTEGER NOT NULL DEFAULT 0,
    "entitiesAccepted" INTEGER NOT NULL DEFAULT 0,
    "actionsCreated" INTEGER NOT NULL DEFAULT 0,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "lastStatus" TEXT,
    "lastResult" TEXT,
    "nextRunAt" DATETIME
);

-- CreateTable
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceDate" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" REAL NOT NULL,
    "provider" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "currentTitle" TEXT NOT NULL,
    "yearsExperience" REAL NOT NULL,
    "education" TEXT NOT NULL,
    "previousCompaniesJson" TEXT NOT NULL DEFAULT '[]',
    "startupExperience" BOOLEAN NOT NULL DEFAULT false,
    "technicalDomain" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "originalSourcingScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InterviewOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "interviewedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HireOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "hired" BOOLEAN NOT NULL,
    "hireDate" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "HireOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "retentionMonths" REAL,
    "managerRating" REAL,
    "promotionVelocityMonths" REAL,
    "customMetricsJson" TEXT NOT NULL DEFAULT '{}',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourcingInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "correlation" REAL,
    "confoundersJson" TEXT NOT NULL DEFAULT '[]',
    "runId" TEXT
);

-- CreateTable
CREATE TABLE "SourcingWeightProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factor" TEXT NOT NULL,
    "oldWeight" REAL NOT NULL,
    "newWeight" REAL NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LearnedRanking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "oldRank" INTEGER NOT NULL,
    "newRank" INTEGER NOT NULL,
    "oldScore" REAL NOT NULL,
    "newScore" REAL NOT NULL,
    "reasonJson" TEXT NOT NULL DEFAULT '[]',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearnedRanking_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prospect" (
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
    "runId" TEXT
);

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "breakdownJson" TEXT NOT NULL DEFAULT '[]',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreHistory_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionMaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "confidence" REAL NOT NULL,
    CONSTRAINT "DecisionMaker_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "sentAt" DATETIME,
    CONSTRAINT "OutreachMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "themeId" TEXT,
    "text" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceDate" DATETIME NOT NULL,
    "audienceLens" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Mention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mention_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    CONSTRAINT "Theme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrendPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "themeId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "mentionCount" INTEGER NOT NULL,
    CONSTRAINT "TrendPoint_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
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
    "aiExplanation" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentRun_agent_startedAt_idx" ON "AgentRun"("agent", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_agentKey_key" ON "ScheduledJob"("agentKey");

-- CreateIndex
CREATE INDEX "AuditLogEntry_entityType_entityId_idx" ON "AuditLogEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Evidence_entityType_entityId_idx" ON "Evidence"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InterviewOutcome_candidateId_idx" ON "InterviewOutcome"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "HireOutcome_candidateId_key" ON "HireOutcome"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceRecord_candidateId_key" ON "PerformanceRecord"("candidateId");

-- CreateIndex
CREATE INDEX "LearnedRanking_candidateId_idx" ON "LearnedRanking"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_dedupeKey_key" ON "Prospect"("dedupeKey");

-- CreateIndex
CREATE INDEX "Prospect_country_vertical_idx" ON "Prospect"("country", "vertical");

-- CreateIndex
CREATE INDEX "ScoreHistory_prospectId_idx" ON "ScoreHistory"("prospectId");

-- CreateIndex
CREATE INDEX "DecisionMaker_prospectId_idx" ON "DecisionMaker"("prospectId");

-- CreateIndex
CREATE INDEX "OutreachMessage_prospectId_idx" ON "OutreachMessage"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Mention_companyId_idx" ON "Mention"("companyId");

-- CreateIndex
CREATE INDEX "Mention_themeId_idx" ON "Mention"("themeId");

-- CreateIndex
CREATE INDEX "Theme_companyId_idx" ON "Theme"("companyId");

-- CreateIndex
CREATE INDEX "TrendPoint_themeId_idx" ON "TrendPoint"("themeId");

-- CreateIndex
CREATE INDEX "Alert_companyId_idx" ON "Alert"("companyId");
