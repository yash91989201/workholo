import z from "zod";

export const DISPOSITION_CODE_REGEX = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export const CreateDispositionListFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "List name is required")
    .max(120, "List name must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
});

export const UpdateDispositionListFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "List name is required")
    .max(120, "List name must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer"),
});

export const AddDispositionEntryFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      DISPOSITION_CODE_REGEX,
      "Code must be uppercase snake-case, for example NOT_INTERESTED"
    ),
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(120, "Label must be 120 characters or fewer"),
});
