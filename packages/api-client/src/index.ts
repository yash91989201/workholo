import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "@workholo/api/routers/index";

export type { CampaignRowSummary } from "@workholo/api/routers/campaigns";
export type {
  ActiveDispositionEntryRow,
  ActiveDispositionListRow,
  DispositionEntryRow,
  DispositionListRow,
} from "@workholo/api/routers/dispositions";
export type { DoNotDialEntryRow } from "@workholo/api/routers/do-not-dial";
export type {
  ActiveLeadListRow,
  ImportLeadRow,
  LeadListRow,
  LeadRow,
} from "@workholo/api/routers/leads";
export type {
  DirectoryRow,
  InvitationRow,
  TeamMemberRow,
  TeamRow,
} from "@workholo/api/routers/organization";

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
