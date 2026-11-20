import { createApiClient } from "@workholo/api-client";

import { ENV } from "../env";

/** Per-router client, so SSR requests never share a query cache. */
export function createApiContext() {
  return createApiClient(ENV.VITE_SERVER_URL);
}

// Stateless query utils; the per-request query cache comes from router context.
export const { orpc } = createApiContext();
