import { createApiClient } from "@workholo/api-client";

import { ENV } from "../env";

export const { client, orpc, queryClient } = createApiClient(
  ENV.VITE_SERVER_URL
);
