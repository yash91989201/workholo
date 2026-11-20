import { call, recording } from "@workholo/db/schema/calls";
import { previewAttempt, previewClaim } from "@workholo/db/schema/preview";
import { and, desc, eq, getColumns } from "drizzle-orm";
import { orgProcedure } from "../index";
import {
  ListCallsInputSchema,
  ListCallsOutputSchema,
  ListRecordingsInputSchema,
  ListRecordingsOutputSchema,
} from "../lib/schemas/calls";
import { organizationScope } from "../utils/tenant";

export const callsRouter = {
  calls: orgProcedure
    .input(ListCallsInputSchema)
    .output(ListCallsOutputSchema)
    .handler(async ({ context, input }) => {
      const scope = organizationScope(context.organizationId);
      const tenant = scope.filter(call.organizationId);
      const where =
        context.membershipRole === "agent"
          ? and(tenant, eq(call.agentId, context.session?.user.id ?? ""))
          : tenant;
      return context.db
        .select({
          ...getColumns(call),
          campaignId: previewClaim.campaignId,
          destination: previewClaim.phone,
          callerId: previewAttempt.callerId,
          outcome: previewAttempt.outcome,
          hangupCause: previewAttempt.hangupCause,
          disposition: previewAttempt.disposition,
        })
        .from(call)
        .leftJoin(previewAttempt, eq(previewAttempt.id, call.id))
        .leftJoin(previewClaim, eq(previewClaim.id, previewAttempt.claimId))
        .where(where)
        .orderBy(desc(call.createdAt), desc(call.id))
        .limit(input.limit);
    }),

  recordings: orgProcedure
    .input(ListRecordingsInputSchema)
    .output(ListRecordingsOutputSchema)
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
