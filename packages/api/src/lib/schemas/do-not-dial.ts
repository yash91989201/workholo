import z from "zod";

const doNotDialEntryRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  createdAt: z.date(),
});

export const ListDoNotDialEntriesInputSchema = z.object({
  organizationId: z.string(),
});
export const ListDoNotDialEntriesOutputSchema = z.array(
  doNotDialEntryRowSchema
);

export const AddDoNotDialEntryInputSchema = z.object({
  organizationId: z.string(),
  number: z.string().trim().min(1).max(40),
});
export const AddDoNotDialEntryOutputSchema = z.object({
  id: z.string(),
  number: z.string(),
});

export const RemoveDoNotDialEntryInputSchema = z.object({
  organizationId: z.string(),
  entryId: z.string(),
});
export const RemoveDoNotDialEntryOutputSchema = z.object({ id: z.string() });

export const CheckDoNotDialNumberInputSchema = z.object({
  organizationId: z.string(),
  number: z.string().trim().min(1).max(40),
});
export const CheckDoNotDialNumberOutputSchema = z.object({
  suppressed: z.boolean(),
});
