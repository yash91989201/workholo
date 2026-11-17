import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  // Client-only: the session check needs the browser cookie.
  ssr: false,
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    const me = await context.queryClient.query({
      ...context.orpc.organization.me.queryOptions(),
      staleTime: "static",
    });
    if (!me.membership) {
      throw redirect({ to: "/onboarding" });
    }
    throw redirect({
      to: "/$orgSlug/dashboard",
      params: { orgSlug: me.membership.slug },
    });
  },
});
