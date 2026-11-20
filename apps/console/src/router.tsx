import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { Loader } from "@workholo/ui/components/loader";
import { routeTree } from "./routeTree.gen";
import { createApiContext } from "./utils/orpc";

export const getRouter = () => {
  const { orpc, queryClient } = createApiContext();

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPendingComponent: () => <Loader />,
    context: { orpc, queryClient },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

export type AppRouter = ReturnType<typeof getRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
