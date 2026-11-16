import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { type AuditSink, createAuditEvent } from "./audit";

type AuditBody = { userId?: string; role?: string };

/**
 * Audit events for the plugin endpoints that never reach an oRPC procedure:
 * impersonation and platform role assignment.
 */
export function createAuditHooks(audit: AuditSink | undefined) {
  return createAuthMiddleware(async (ctx) => {
    if (!audit) {
      return;
    }
    const session = await getSessionFromCtx(ctx);
    const body = (ctx.body ?? {}) as AuditBody;

    if (ctx.path === "/admin/impersonate-user" && body.userId) {
      const actorId = session?.session.impersonatedBy ?? session?.user.id;
      if (actorId) {
        audit(
          createAuditEvent(actorId, "impersonation.start", {
            type: "user",
            id: body.userId,
          })
        );
      }
      return;
    }

    if (ctx.path === "/admin/stop-impersonating") {
      const actorId = session?.session.impersonatedBy;
      if (actorId) {
        audit(
          createAuditEvent(actorId, "impersonation.stop", {
            type: "user",
            id: session?.user.id ?? "",
          })
        );
      }
      return;
    }

    if (
      ctx.path === "/admin/set-role" &&
      body.userId &&
      body.role &&
      session?.user.id
    ) {
      audit(
        createAuditEvent(
          session.user.id,
          "user.platform_role_change",
          { type: "user", id: body.userId },
          body.role
        )
      );
    }
  });
}
