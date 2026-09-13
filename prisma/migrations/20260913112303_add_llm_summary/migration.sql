-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN "llmModel" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "llmProvider" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "llmSummary" TEXT;
