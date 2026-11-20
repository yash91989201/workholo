import { ORPCError } from "@orpc/server";
import type { OrganizationContext } from "../context";
import { orgProcedure, requireRoles } from "../index";
import {
  ClaimPreviewInputSchema,
  ClaimPreviewOutputSchema,
  DialPreviewInputSchema,
  DialPreviewOutputSchema,
  GetPreviewPresenceInputSchema,
  GetPreviewPresenceOutputSchema,
  GetPreviewStateInputSchema,
  GetPreviewStateOutputSchema,
  ListPreviewCampaignsInputSchema,
  ListPreviewCampaignsOutputSchema,
  PreparePreviewPhoneInputSchema,
  PreparePreviewPhoneOutputSchema,
  SetPreviewWorkStatusInputSchema,
  SetPreviewWorkStatusOutputSchema,
  SkipPreviewInputSchema,
  SkipPreviewOutputSchema,
  SubmitPreviewDispositionInputSchema,
  SubmitPreviewDispositionOutputSchema,
} from "../lib/schemas/preview";
import {
  claimPreview,
  dialPreview,
  getPreviewState,
  mappedPhone,
  preparePreviewPhone,
  requirePreviewAgent,
  requireTelephony,
  skipPreview,
  submitPreviewDisposition,
} from "../services/preview-work";
import { o } from "../utils/orpc";
import {
  assignedPreviewCampaigns,
  lockPreviewOrganization,
  requirePreviewCampaign,
} from "../utils/preview";

const resolvePreviewAgent = o.middleware(async ({ context, next }) => {
  // Org middleware owns input/tenant validation; look up the stable member ID again.
  const { organizationId } = context as OrganizationContext;
  const { session } = context;
  if (!session) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (session.session.impersonatedBy) {
    throw new ORPCError("FORBIDDEN", {
      message: "Campaign calling requires the agent’s own session",
    });
  }
  const agent = await requirePreviewAgent(
    context.db,
    organizationId,
    session.user.id
  );
  return next({ context: { agent } });
});

const agentProcedure = orgProcedure
  .use(requireRoles(["agent"]))
  .use(resolvePreviewAgent);

export const previewRouter = {
  listCampaigns: agentProcedure
    .input(ListPreviewCampaignsInputSchema)
    .output(ListPreviewCampaignsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await assignedPreviewCampaigns(context.db, context.agent);
      return rows.map(({ id, name }) => ({ id, name }));
    }),
  preparePhone: agentProcedure
    .input(PreparePreviewPhoneInputSchema)
    .output(PreparePreviewPhoneOutputSchema)
    .handler(({ context, input }) =>
      preparePreviewPhone(context, context.agent, input.campaignId)
    ),
  getPresence: agentProcedure
    .input(GetPreviewPresenceInputSchema)
    .output(GetPreviewPresenceOutputSchema)
    .handler(async ({ context }) => {
      const id = await mappedPhone(context.db, context.agent);
      const presence = id
        ? await requireTelephony(context).getPresence(id)
        : null;
      return presence && presence.agent_id === id
        ? {
            presence: presence.presence,
            workStatus: presence.work_status,
            sipRegistered: presence.sip_registered,
          }
        : null;
    }),
  setWorkStatus: agentProcedure
    .input(SetPreviewWorkStatusInputSchema)
    .output(SetPreviewWorkStatusOutputSchema)
    .handler(({ context, input }) =>
      context.db.transaction(async (tx) => {
        await lockPreviewOrganization(tx, context.agent.organizationId);
        const agent = await requirePreviewAgent(
          tx,
          context.agent.organizationId,
          context.agent.userId
        );
        if (input.status === "ready") {
          if (!input.campaignId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Campaign is required for Ready",
            });
          }
          await requirePreviewCampaign(tx, agent, input.campaignId);
        }
        const id = await mappedPhone(tx, agent);
        if (!id) {
          return false;
        }
        const presence = await requireTelephony(context).setStatus(
          id,
          input.status
        );
        return (
          presence.agent_id === id && presence.work_status === input.status
        );
      })
    ),
  getState: agentProcedure
    .input(GetPreviewStateInputSchema)
    .output(GetPreviewStateOutputSchema)
    .handler(({ context }) => getPreviewState(context.db, context.agent)),
  claim: agentProcedure
    .input(ClaimPreviewInputSchema)
    .output(ClaimPreviewOutputSchema)
    .handler(({ context, input }) =>
      claimPreview(
        context,
        context.agent,
        input.campaignId,
        context.session.session.id
      )
    ),
  skip: agentProcedure
    .input(SkipPreviewInputSchema)
    .output(SkipPreviewOutputSchema)
    .handler(({ context, input }) =>
      skipPreview(
        context.db,
        context.agent,
        input.previewId,
        context.session.session.id
      )
    ),
  dial: agentProcedure
    .input(DialPreviewInputSchema)
    .output(DialPreviewOutputSchema)
    .handler(({ context, input }) =>
      dialPreview(context, context.agent, input.previewId)
    ),
  submitDisposition: agentProcedure
    .input(SubmitPreviewDispositionInputSchema)
    .output(SubmitPreviewDispositionOutputSchema)
    .handler(({ context, input }) =>
      submitPreviewDisposition(
        context.db,
        context.agent,
        input.callId,
        input.dispositionId
      )
    ),
};
