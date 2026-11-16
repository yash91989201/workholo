import { createOrgAuthClient } from "@workholo/auth-client";

import { ENV } from "../env";

export const authClient = createOrgAuthClient(ENV.VITE_SERVER_URL);
