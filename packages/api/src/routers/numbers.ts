import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { consoleProcedure } from "../index";
import {
  ListEligibleOutboundNumbersInputSchema,
  ListEligibleOutboundNumbersOutputSchema,
} from "../lib/schemas/numbers";

export type EligibleOutboundNumberRow = z.infer<
  typeof ListEligibleOutboundNumbersOutputSchema
>[number];

export const numbersRouter = {
  /** Console read: only this organization's assigned, enabled numbers. */
  listEligibleOutboundNumbers: consoleProcedure
    .input(ListEligibleOutboundNumbersInputSchema)
    .output(ListEligibleOutboundNumbersOutputSchema)
    .handler(async ({ context }) =>
      context.db
        .select({ id: outboundNumber.id, number: outboundNumber.number })
        .from(outboundNumberAssignment)
        .innerJoin(
          outboundNumber,
          eq(outboundNumber.id, outboundNumberAssignment.numberId)
        )
        .where(
          and(
            eq(outboundNumberAssignment.organizationId, context.organizationId),
            eq(outboundNumber.enabled, true)
          )
        )
        .orderBy(outboundNumber.number)
    ),
};
