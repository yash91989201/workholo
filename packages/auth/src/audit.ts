export const AUDIT_ACTIONS = [
  "organization.suspend",
  "organization.restore",
  "organization.delete",
  "impersonation.start",
  "impersonation.stop",
  "user.platform_role_change",
  "lead_list.create",
  "lead_list.update",
  "lead_list.archive",
  "lead_list.lead_add",
  "lead_list.lead_remove",
  "lead_list.import",
  "disposition_list.create",
  "disposition_list.update",
  "disposition_list.archive",
  "disposition_list.entry_add",
  "disposition_list.entry_retire",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditTarget = {
  type: "organization" | "user" | "lead_list" | "disposition_list";
  id: string;
  /** Owning organization for resource targets. */
  organizationId?: string;
};

export type AuditEvent = {
  actorId: string;
  action: AuditAction;
  target: AuditTarget;
  reason?: string;
  timestamp: string;
};

export type AuditSink = (event: AuditEvent) => void;

export function createAuditEvent(
  actorId: string,
  action: AuditAction,
  target: AuditTarget,
  reason?: string
): AuditEvent {
  return {
    actorId,
    action,
    target,
    ...(reason === undefined ? {} : { reason }),
    timestamp: new Date().toISOString(),
  };
}
