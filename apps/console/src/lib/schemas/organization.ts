import z from "zod";

export const CreateOrganizationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use kebab case: lowercase words joined by single hyphens"
    ),
  slugLocked: z.boolean(),
});
