import z from "zod";

export const RegisterOutboundNumberFormSchema = z.object({
  number: z.string().trim().min(1, "Number is required"),
});
