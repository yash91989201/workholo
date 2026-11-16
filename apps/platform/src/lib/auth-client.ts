import { createAdminAuthClient } from "@workholo/auth-client";

import { ENV } from "../env";

export const authClient = createAdminAuthClient(ENV.VITE_SERVER_URL);
