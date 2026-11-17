import { createApiClient } from "@workholo/api-client";

import { ENV } from "../env";

/** Per-router client, so SSR requests never share a query cache. */
export function createApiContext() {
  return createApiClient(ENV.VITE_SERVER_URL);
}

export const { orpc, client, queryClient } = createApiContext();
