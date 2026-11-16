import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "@workholo/api/routers/index";
import { toast } from "sonner";

export type ApiClient = {
  client: AppRouterClient;
  queryClient: QueryClient;
  orpc: ReturnType<typeof createTanstackQueryUtils<AppRouterClient>>;
};

/** One oRPC client factory shared by every frontend surface. */
export function createApiClient(serverUrl: string): ApiClient {
  const base = serverUrl.replace(/\/$/, "");
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });

  const link = new RPCLink({
    url: `${base}/rpc`,
    fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: "include",
      });
    },
  });

  const client: AppRouterClient = createORPCClient(link);

  return { client, queryClient, orpc: createTanstackQueryUtils(client) };
}
