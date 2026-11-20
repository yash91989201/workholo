import z from "zod";

export const CreateLeadListFormSchema = z.object({
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

export const UpdateLeadListFormSchema = z.object({
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

export const AddLeadFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(40, "Phone number must be 40 characters or fewer"),
  name: z.string().trim().max(120, "Name must be 120 characters or fewer"),
});

export const ImportLeadsFormSchema = z.object({
  csv: z.string().min(1, "Choose a CSV file"),
});
