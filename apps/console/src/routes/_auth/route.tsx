import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ context, location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const me = await context.queryClient.ensureQueryData(
      context.orpc.organization.me.queryOptions()
    );
    if (!me.membership) {
      throw redirect({ to: "/onboarding" });
    }
    if (me.membership.role !== "owner" && me.membership.role !== "admin") {
      throw redirect({ to: "/denied" });
    }

    return { session: session.data, membership: me.membership };
  },
});

function AuthLayout() {
  return <Outlet />;
}
