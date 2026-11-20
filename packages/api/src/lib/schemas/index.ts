import z from "zod";

import { SessionUserSchema } from "./shared";

export const CheckHealthOutputSchema = z.literal("OK");

export const GetPrivateDataOutputSchema = z.object({
  message: z.string(),
  user: SessionUserSchema.optional(),
});
