-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "entitiesFound" INTEGER NOT NULL DEFAULT 0,
    "entitiesAccepted" INTEGER NOT NULL DEFAULT 0,
    "actionsCreated" INTEGER NOT NULL DEFAULT 0,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "llmSummary" TEXT,
    "llmProvider" TEXT,
    "llmModel" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastResult" TEXT,
    "nextRunAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentTitle" TEXT NOT NULL,
    "yearsExperience" DOUBLE PRECISION NOT NULL,
    "education" TEXT NOT NULL,
    "previousCompaniesJson" TEXT NOT NULL DEFAULT '[]',
    "startupExperience" BOOLEAN NOT NULL DEFAULT false,
    "eliteUniversity" BOOLEAN NOT NULL DEFAULT false,
    "priorLeadership" BOOLEAN NOT NULL DEFAULT false,
    "technicalDomain" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "originalSourcingScore" DOUBLE PRECISION NOT NULL,
    "isNewBatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewOutcome" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "interviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireOutcome" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "hired" BOOLEAN NOT NULL,
    "hireDate" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "HireOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "retentionMonths" DOUBLE PRECISION,
    "managerRating" DOUBLE PRECISION,
    "promotionVelocityMonths" DOUBLE PRECISION,
    "stillEmployed" BOOLEAN NOT NULL DEFAULT true,
    "department" TEXT,
    "roleHiredInto" TEXT,
    "currentRole" TEXT,
    "promotions" INTEGER NOT NULL DEFAULT 0,
    "highPerformer" BOOLEAN NOT NULL DEFAULT false,
    "customMetricsJson" TEXT NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingInsight" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "correlation" DOUBLE PRECISION,
    "confoundersJson" TEXT NOT NULL DEFAULT '[]',
    "runId" TEXT,

    CONSTRAINT "SourcingInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingWeightProposal" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factor" TEXT NOT NULL,
    "oldWeight" DOUBLE PRECISION NOT NULL,
    "newWeight" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SourcingWeightProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnedRanking" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "oldRank" INTEGER NOT NULL,
    "newRank" INTEGER NOT NULL,
    "oldScore" DOUBLE PRECISION NOT NULL,
    "newScore" DOUBLE PRECISION NOT NULL,
    "reasonJson" TEXT NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnedRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingModelEvaluation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidatesReviewed" INTEGER NOT NULL,
    "hiresAnalyzed" INTEGER NOT NULL,
    "trainSize" INTEGER NOT NULL,
    "holdoutSize" INTEGER NOT NULL,
    "kUsed" INTEGER NOT NULL,
    "v1Precision" DOUBLE PRECISION NOT NULL,
    "v2Precision" DOUBLE PRECISION NOT NULL,
    "improvementPct" DOUBLE PRECISION,
    "validationStatus" TEXT NOT NULL,
    "highPerformerDefinition" TEXT NOT NULL,
    "factorAuditJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "SourcingModelEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "website" TEXT,
    "employeeCountEstimate" TEXT,
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreBreakdownJson" TEXT NOT NULL DEFAULT '[]',
    "useCase" TEXT,
    "useCaseRationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "whyJson" TEXT NOT NULL DEFAULT '[]',
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT,
    "discoveryMode" TEXT NOT NULL DEFAULT 'demo',

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "breakdownJson" TEXT NOT NULL DEFAULT '[]',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionMaker" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "whyThisPerson" TEXT,
    "isReal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DecisionMaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "decisionMakerId" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "replyNote" TEXT,
    "nextAction" TEXT,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "themeId" TEXT,
    "text" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "audienceLens" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendPoint" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "mentionCount" INTEGER NOT NULL,

    CONSTRAINT "TrendPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEmailNotification" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sent" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "OutreachMessage_decisionMakerId_idx" ON "OutreachMessage"("decisionMakerId");

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
CREATE UNIQUE INDEX "AlertSubscriber_email_key" ON "AlertSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEmailNotification_themeId_weekStart_key" ON "AlertEmailNotification"("themeId", "weekStart");

-- CreateIndex
CREATE INDEX "Alert_companyId_idx" ON "Alert"("companyId");

-- AddForeignKey
ALTER TABLE "InterviewOutcome" ADD CONSTRAINT "InterviewOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireOutcome" ADD CONSTRAINT "HireOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnedRanking" ADD CONSTRAINT "LearnedRanking_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreHistory" ADD CONSTRAINT "ScoreHistory_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionMaker" ADD CONSTRAINT "DecisionMaker_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_decisionMakerId_fkey" FOREIGN KEY ("decisionMakerId") REFERENCES "DecisionMaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendPoint" ADD CONSTRAINT "TrendPoint_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
