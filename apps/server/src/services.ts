import { createAuth } from "@workholo/auth";
import { createDb } from "@workholo/db";

import { ENV, desktopOrigins } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db, desktopOrigins);
