import z from "zod";

export const CAMPAIGN_METHODS = ["preview"] as const;
export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;
export const CAMPAIGN_DIAL_STATUSES = ["new", "not_answered"] as const;
export const CAMPAIGN_CALLER_ID_MODES = ["fixed", "random"] as const;
export const CAMPAIGN_ASSIGNEE_TYPES = ["agent", "team"] as const;

/** Shared with telephony-service: the customer leg never rings longer. */
export const RING_TIMEOUT_MAX_SECONDS = 120;

export type CampaignFieldErrors = Record<string, string>;

const campaignIdShape = {
  organizationId: z.string(),
  campaignId: z.string(),
};

const transitionShape = {
  ...campaignIdShape,
  expectedRevision: z.number().int().min(0),
};

const leadListRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  archivedAt: z.date().nullable(),
});

const numberRefSchema = z.object({
  id: z.string(),
  number: z.string(),
  enabled: z.boolean(),
});

const dispositionListRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  archivedAt: z.date().nullable(),
});

export const ListCampaignsInputSchema = z.object({
  organizationId: z.string(),
});
export const ListCampaignsOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    method: z.enum(CAMPAIGN_METHODS),
    status: z.enum(CAMPAIGN_STATUSES),
    revision: z.number().int(),
    leadListCount: z.number().int(),
    numberCount: z.number().int(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
);

export const GetCampaignInputSchema = z.object(campaignIdShape);
export const GetCampaignOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  method: z.enum(CAMPAIGN_METHODS),
  status: z.enum(CAMPAIGN_STATUSES),
  revision: z.number().int(),
  leadLists: z.array(leadListRefSchema),
  dispositionList: dispositionListRefSchema.nullable(),
  numbers: z.array(numberRefSchema),
  callerIdMode: z.enum(CAMPAIGN_CALLER_ID_MODES).nullable(),
  assigneeType: z.enum(CAMPAIGN_ASSIGNEE_TYPES).nullable(),
  assigneeId: z.string().nullable(),
  previewSeconds: z.number().int().nullable(),
  ringTimeoutSeconds: z.number().int().nullable(),
  wrapUpSeconds: z.number().int().nullable(),
  afterCallWorkSeconds: z.number().int().nullable(),
  retryCount: z.number().int().nullable(),
  retryIntervalMinutes: z.number().int().nullable(),
  dialStatuses: z.array(z.enum(CAMPAIGN_DIAL_STATUSES)),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateCampaignInputSchema = z.object({
  organizationId: z.string(),
  name: z.string().trim().min(1).max(120),
  method: z.enum(CAMPAIGN_METHODS),
  description: z.string().trim().max(500).optional(),
});
export const CreateCampaignOutputSchema = z.object({ id: z.string() });

export const UpdateCampaignInputSchema = z.object({
  ...campaignIdShape,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
  leadListIds: z.array(z.string()),
  dispositionListId: z.string().nullable(),
  callerIdMode: z.enum(CAMPAIGN_CALLER_ID_MODES).nullable(),
  numberIds: z.array(z.string()),
  assigneeType: z.enum(CAMPAIGN_ASSIGNEE_TYPES).nullable(),
  assigneeId: z.string().nullable(),
  previewSeconds: z.number().int().min(1).nullable(),
  ringTimeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(RING_TIMEOUT_MAX_SECONDS)
    .nullable(),
  wrapUpSeconds: z.number().int().min(0).nullable(),
  afterCallWorkSeconds: z.number().int().min(0).nullable(),
  retryCount: z.number().int().min(0).nullable(),
  retryIntervalMinutes: z.number().int().min(1).nullable(),
  dialStatuses: z.array(z.enum(CAMPAIGN_DIAL_STATUSES)),
});
export const UpdateCampaignOutputSchema = z.object({ id: z.string() });

export const ActivateCampaignInputSchema = z.object(transitionShape);
export const ActivateCampaignOutputSchema = z.object({
  id: z.string(),
  status: z.literal("active"),
  revision: z.number().int(),
});

export const PauseCampaignInputSchema = z.object(transitionShape);
export const PauseCampaignOutputSchema = z.object({
  id: z.string(),
  status: z.literal("paused"),
  revision: z.number().int(),
});

export const ArchiveCampaignInputSchema = z.object(transitionShape);
export const ArchiveCampaignOutputSchema = z.object({
  id: z.string(),
  status: z.literal("archived"),
  revision: z.number().int(),
});
