import type { Context as ApiContext } from "@workholo/api/context";
import type { Context as ElysiaContext } from "elysia";

import { ENV } from "./env.server";
import { audit, auth, db } from "./services";

export type CreateContextOptions = {
  context: ElysiaContext;
};

export async function createContext({
  context,
}: CreateContextOptions): Promise<ApiContext> {
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });
  return {
    db,
    session,
    audit,
    invitationOrigins: { console: ENV.CONSOLE_ORIGIN, agent: ENV.AGENT_ORIGIN },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
