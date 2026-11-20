import z from "zod";

/** Uppercase snake-case, stable once created. */
export const DISPOSITION_CODE_REGEX = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const listInputShape = {
  organizationId: z.string(),
  listId: z.string(),
};

const dispositionEntryRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  retiredAt: z.date().nullable(),
  createdAt: z.date(),
});

export const ListDispositionListsInputSchema = z.object({
  organizationId: z.string(),
});
export const ListDispositionListsOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    archivedAt: z.date().nullable(),
    entryCount: z.number().int(),
    createdAt: z.date(),
  })
);

export const GetDispositionListInputSchema = z.object(listInputShape);
export const GetDispositionListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  entries: z.array(dispositionEntryRowSchema),
});

export const CreateDispositionListInputSchema = z.object({
  organizationId: z.string(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
export const CreateDispositionListOutputSchema = z.object({ id: z.string() });

export const UpdateDispositionListInputSchema = z.object({
  ...listInputShape,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable(),
});
export const UpdateDispositionListOutputSchema = z.object({ id: z.string() });

export const ArchiveDispositionListInputSchema = z.object(listInputShape);
export const ArchiveDispositionListOutputSchema = z.object({ id: z.string() });

export const AddDispositionEntryInputSchema = z.object({
  ...listInputShape,
  code: z
    .string()
    .trim()
    .regex(
      DISPOSITION_CODE_REGEX,
      "Code must be uppercase snake-case, for example NOT_INTERESTED"
    ),
  label: z.string().trim().min(1).max(120),
});
export const AddDispositionEntryOutputSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
});

export const RetireDispositionEntryInputSchema = z.object({
  ...listInputShape,
  entryId: z.string(),
});
export const RetireDispositionEntryOutputSchema = z.object({ id: z.string() });

/** Historical lookup: resolves retired entries and archived lists. */
export const GetDispositionEntryInputSchema = z.object({
  organizationId: z.string(),
  entryId: z.string(),
});
export const GetDispositionEntryOutputSchema = z.object({
  id: z.string(),
  listId: z.string(),
  code: z.string(),
  label: z.string(),
  retiredAt: z.date().nullable(),
  listArchivedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const ListActiveDispositionListsInputSchema = z.object({
  organizationId: z.string(),
});
export const ListActiveDispositionListsOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    entryCount: z.number().int(),
  })
);

export const ListActiveDispositionEntriesInputSchema = z.object(listInputShape);
export const ListActiveDispositionEntriesOutputSchema = z.array(
  z.object({
    id: z.string(),
    code: z.string(),
    label: z.string(),
  })
);
