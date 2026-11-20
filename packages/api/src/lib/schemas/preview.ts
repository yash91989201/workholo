import z from "zod";

const organizationInput = z.object({ organizationId: z.string().min(1) });
const campaignInput = organizationInput.extend({
  campaignId: z.string().min(1),
});
const previewInput = organizationInput.extend({ previewId: z.uuid() });
const disposition = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
});

const preview = z.object({
  id: z.string(),
  campaignId: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  expiresAt: z.iso.datetime(),
});

export const ListPreviewCampaignsInputSchema = organizationInput;
export const ListPreviewCampaignsOutputSchema = z.array(
  z.object({ id: z.string(), name: z.string() })
);
export const PreparePreviewPhoneInputSchema = campaignInput;
export const PreparePreviewPhoneOutputSchema = z.object({
  sipUsername: z.string(),
  sipPassword: z.string(),
  sipDomain: z.string(),
  wssUrl: z.string(),
});
export const GetPreviewPresenceInputSchema = organizationInput;
export const GetPreviewPresenceOutputSchema = z
  .object({
    presence: z.string(),
    workStatus: z.string(),
    sipRegistered: z.boolean(),
  })
  .nullable();
export const SetPreviewWorkStatusInputSchema = organizationInput.extend({
  status: z.enum(["ready", "offline"]),
  campaignId: z.string().min(1).optional(),
});
export const SetPreviewWorkStatusOutputSchema = z.boolean();
export const GetPreviewStateInputSchema = organizationInput;
export const GetPreviewStateOutputSchema = z.object({
  preview: preview.nullable(),
  attempt: z
    .object({
      id: z.string(),
      campaignId: z.string(),
      status: z.string(),
      dispatchExpiresAt: z.iso.datetime(),
      outcome: z.string().nullable(),
      hangupCause: z.string().nullable(),
      rejectReason: z.string().nullable(),
      dispositionOptions: z.array(disposition),
      disposition: disposition.nullable(),
      wrapupUntil: z.iso.datetime().nullable(),
      holdUntil: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export const ClaimPreviewInputSchema = campaignInput;
export const ClaimPreviewOutputSchema = preview.nullable();
export const SkipPreviewInputSchema = previewInput;
export const SkipPreviewOutputSchema = z.boolean();
export const DialPreviewInputSchema = previewInput;
export const DialPreviewOutputSchema = z.object({ id: z.uuid() });
export const SubmitPreviewDispositionInputSchema = organizationInput.extend({
  callId: z.uuid(),
  dispositionId: z.string().min(1),
});
export const SubmitPreviewDispositionOutputSchema = z.boolean();
