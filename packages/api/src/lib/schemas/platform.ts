import z from "zod";

const organizationIdShape = { organizationId: z.string() };

export const ListOrganizationsInputSchema = z.object({
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export const ListOrganizationsOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      createdAt: z.date(),
      suspendedAt: z.date().nullable(),
      suspendedReason: z.string().nullable(),
      memberCount: z.number(),
      status: z.enum(["active", "suspended"]),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const SuspendOrganizationInputSchema = z.object({
  ...organizationIdShape,
  reason: z.string().min(1),
});
export const SuspendOrganizationOutputSchema = z
  .object({ id: z.string(), suspendedAt: z.date().nullable() })
  .nullable();

export const RestoreOrganizationInputSchema = z.object(organizationIdShape);
export const RestoreOrganizationOutputSchema = z
  .object({ id: z.string() })
  .nullable();

export const DeleteOrganizationInputSchema = z.object(organizationIdShape);
export const DeleteOrganizationOutputSchema = z
  .object({ id: z.string() })
  .nullable();
