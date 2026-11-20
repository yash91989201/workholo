import z from "zod";

const listInputShape = {
  organizationId: z.string(),
  listId: z.string(),
};

const leadListRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  archivedAt: z.date().nullable(),
  leadCount: z.number().int(),
  createdAt: z.date(),
});

const leadRowSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
});

export const ListLeadListsInputSchema = z.object({
  organizationId: z.string(),
});
export const ListLeadListsOutputSchema = z.array(leadListRowSchema);

export const GetLeadListInputSchema = z.object(listInputShape);
export const GetLeadListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  leads: z.array(leadRowSchema),
});

export const CreateLeadListInputSchema = z.object({
  organizationId: z.string(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
export const CreateLeadListOutputSchema = z.object({ id: z.string() });

export const UpdateLeadListInputSchema = z.object({
  ...listInputShape,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
});
export const UpdateLeadListOutputSchema = z.object({ id: z.string() });

export const ArchiveLeadListInputSchema = z.object(listInputShape);
export const ArchiveLeadListOutputSchema = z.object({ id: z.string() });

export const AddLeadInputSchema = z.object({
  ...listInputShape,
  phone: z.string().trim().min(1).max(40),
  name: z.string().trim().max(120).optional(),
});
export const AddLeadOutputSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
});

export const RemoveLeadInputSchema = z.object({
  ...listInputShape,
  leadId: z.string(),
});
export const RemoveLeadOutputSchema = z.object({ id: z.string() });

export const ImportLeadsInputSchema = z.object({
  ...listInputShape,
  csv: z.string().min(1),
});
export const ImportLeadsOutputSchema = z.array(
  z.object({
    line: z.number().int(),
    phone: z.string(),
    name: z.string().nullable(),
    status: z.enum(["imported", "invalid", "existing", "repeated"]),
    reason: z.string().nullable(),
  })
);

export const ListActiveLeadListsInputSchema = z.object({
  organizationId: z.string(),
});
export const ListActiveLeadListsOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    leadCount: z.number().int(),
  })
);

export const ListActiveLeadsInputSchema = z.object(listInputShape);
export const ListActiveLeadsOutputSchema = z.array(leadRowSchema);
