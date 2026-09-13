import { db } from "@/lib/db";

export async function logAudit(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}) {
  await db.auditLogEntry.create({
    data: {
      actor: params.actor,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detailJson: JSON.stringify(params.detail ?? {}),
    },
  });
}
