import type { Session } from "@workholo/auth";
import type { Database } from "@workholo/db";

export type Context = {
  session: Session | null;
  db: Database;
};
