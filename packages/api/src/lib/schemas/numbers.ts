import z from "zod";

const outboundNumberRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  enabled: z.boolean(),
  createdAt: z.date(),
  assignedOrganizationId: z.string().nullable(),
  assignedOrganizationName: z.string().nullable(),
});

export const ListOutboundNumbersOutputSchema = z.array(outboundNumberRowSchema);

export const RegisterOutboundNumberInputSchema = z.object({
  number: z.string().trim().min(1),
});
export const RegisterOutboundNumberOutputSchema = z.object({
  id: z.string(),
  number: z.string(),
});

export const SetOutboundNumberEnabledInputSchema = z.object({
  numberId: z.string(),
  enabled: z.boolean(),
});
export const SetOutboundNumberEnabledOutputSchema = z
  .object({ id: z.string(), enabled: z.boolean() })
  .nullable();

export const AssignOutboundNumberInputSchema = z.object({
  numberId: z.string(),
  organizationId: z.string(),
});
export const AssignOutboundNumberOutputSchema = z
  .object({ id: z.string(), organizationId: z.string() })
  .nullable();

export const UnassignOutboundNumberInputSchema = z.object({
  numberId: z.string(),
});
export const UnassignOutboundNumberOutputSchema = z
  .object({ id: z.string() })
  .nullable();

export const ListEligibleOutboundNumbersInputSchema = z.object({
  organizationId: z.string(),
});
export const ListEligibleOutboundNumbersOutputSchema = z.array(
  z.object({ id: z.string(), number: z.string() })
);
