import z from "zod";

export const SuspendOrganizationFormSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required"),
});
