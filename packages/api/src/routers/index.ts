import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import {
  CheckHealthOutputSchema,
  GetPrivateDataOutputSchema,
} from "../lib/schemas/index";
import { callsRouter } from "./calls";
import { campaignsRouter } from "./campaigns";
import { dispositionsRouter } from "./dispositions";
import { doNotDialRouter } from "./do-not-dial";
import { leadsRouter } from "./leads";
import { numbersRouter } from "./numbers";
import { organizationRouter } from "./organization";
import { platformRouter } from "./platform";
import { previewRouter } from "./preview";

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
  campaigns: campaignsRouter,
  leads: leadsRouter,
  numbers: numbersRouter,
  dispositions: dispositionsRouter,
  doNotDial: doNotDialRouter,
  platform: platformRouter,
  preview: previewRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
