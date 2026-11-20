import z from "zod";

/** Mirrors RING_TIMEOUT_MAX_SECONDS in the API schema. */
const RING_TIMEOUT_MAX_SECONDS = 120;

export const CAMPAIGN_CALLER_ID_MODES = ["fixed", "random"] as const;
export const CAMPAIGN_DIAL_STATUSES = ["new", "not_answered"] as const;

const wholeNumber = (message: string, min: number, max?: number) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") {
        return true;
      }
      if (!/^\d+$/.test(value)) {
        return false;
      }
      const number = Number(value);
      return number >= min && (max === undefined || number <= max);
    }, message);

export const CreateCampaignFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(120, "Campaign name must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
});

export const CampaignFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(120, "Campaign name must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
  leadListIds: z.array(z.string()),
  dispositionListId: z.string(),
  callerIdMode: z.union([z.literal(""), z.enum(CAMPAIGN_CALLER_ID_MODES)]),
  numberIds: z.array(z.string()),
  assignee: z.string(),
  previewSeconds: wholeNumber("Preview duration must be 1 second or more", 1),
  ringTimeoutSeconds: wholeNumber(
    `Customer ring timeout must be between 1 and ${RING_TIMEOUT_MAX_SECONDS} seconds`,
    1,
    RING_TIMEOUT_MAX_SECONDS
  ),
  wrapUpSeconds: wholeNumber("Wrap-up must be 0 seconds or more", 0),
  afterCallWorkSeconds: wholeNumber(
    "After-call work must be 0 seconds or more",
    0
  ),
  retryCount: wholeNumber("Retry count must be 0 or more", 0),
  retryIntervalMinutes: wholeNumber(
    "Retry interval must be 1 minute or more",
    1
  ),
  dialStatuses: z.array(z.enum(CAMPAIGN_DIAL_STATUSES)),
});
