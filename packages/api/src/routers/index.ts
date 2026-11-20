import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import {
  CheckHealthOutputSchema,
  GetPrivateDataOutputSchema,
} from "../lib/schemas/index";
import { callsRouter } from "./calls";
import { dispositionsRouter } from "./dispositions";
import { leadsRouter } from "./leads";
import { numbersRouter } from "./numbers";
import { organizationRouter } from "./organization";
import { platformRouter } from "./platform";

export const appRouter = {
  healthCheck: publicProcedure
    .output(CheckHealthOutputSchema)
    .handler(() => "OK"),
  privateData: protectedProcedure
    .output(GetPrivateDataOutputSchema)
    .handler(({ context }) => ({
      message: "This is private",
      user: context.session?.user,
    })),
  organization: organizationRouter,
  calls: callsRouter,
  leads: leadsRouter,
  numbers: numbersRouter,
  dispositions: dispositionsRouter,
  platform: platformRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
