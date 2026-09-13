// Source of truth for the "enum-like" string fields in prisma/schema.prisma
// (SQLite has no native Prisma enum support).

export const AGENT_KEYS = ["TALENT_INTELLIGENCE", "COMPANY_SCOUT", "EXTERNAL_RADAR"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

export const RUN_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const APPROVAL_KINDS = ["SOURCING_WEIGHT_CHANGE", "OUTREACH_EMAIL"] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const FEEDBACK_TARGETS = ["PROSPECT", "ALERT", "TALENT_INSIGHT"] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];

export const FEEDBACK_VOTES = ["UP", "DOWN"] as const;
export type FeedbackVote = (typeof FEEDBACK_VOTES)[number];

export const INSIGHT_KINDS = ["CORRELATION", "RECOMMENDATION"] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const PROSPECT_STATUSES = [
  "NEW",
  "RESEARCHED",
  "SCORED",
  "OUTREACH_READY",
  "CONTACTED",
  "REPLIED",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const OUTREACH_CHANNELS = ["EMAIL", "LINKEDIN"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_STATUSES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
  "REPLIED",
  "FOLLOW_UP_DUE",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const AUDIENCE_LENSES = ["CANDIDATE", "CUSTOMER", "EXECUTIVE", "INVESTOR"] as const;
export type AudienceLens = (typeof AUDIENCE_LENSES)[number];

export const SENTIMENTS = ["POSITIVE", "NEGATIVE", "NEUTRAL"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const ALERT_TYPES = ["RISK", "OPPORTUNITY"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "DISMISSED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface ScoreComponent {
  label: string;
  score: number;
  max: number;
  why: string;
  evidenceIds: string[];
}

export interface AgentStep {
  label: string;
  detail: string;
  at: string; // ISO timestamp
}

export interface WeightReason {
  factor: string;
  contribution: number;
  detail: string;
}
