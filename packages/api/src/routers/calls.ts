import { call, recording } from "@workholo/db/schema/calls";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { orgProcedure } from "../index";
import { organizationScope } from "../tenant";

const historyInput = z.object({
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const callsRouter = {
  calls: orgProcedure
    .input(historyInput)
    .handler(async ({ context, input }) => {
      const scope = organizationScope(context.organizationId);
      const tenant = scope.filter(call.organizationId);
      const where =
        context.membershipRole === "agent"
          ? and(tenant, eq(call.agentId, context.session?.user.id ?? ""))
          : tenant;
      return context.db.select().from(call).where(where).limit(input.limit);
    }),

  recordings: orgProcedure
    .input(historyInput)
    .handler(async ({ context, input }) => {
      const scope = organizationScope(context.organizationId);
      const tenant = scope.filter(recording.organizationId);
      const where =
        context.membershipRole === "agent"
          ? and(tenant, eq(recording.agentId, context.session?.user.id ?? ""))
          : tenant;
      return context.db
        .select()
        .from(recording)
        .where(where)
        .limit(input.limit);
    }),
};
