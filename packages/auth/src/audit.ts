export const AUDIT_ACTIONS = [
  "organization.suspend",
  "organization.restore",
  "organization.delete",
  "impersonation.start",
  "impersonation.stop",
  "user.platform_role_change",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditTarget = { type: "organization" | "user"; id: string };

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
