import z from "zod";

export const AddDoNotDialEntryFormSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(40, "Phone number must be 40 characters or fewer"),
});
