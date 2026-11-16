import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import Denied from "@/components/denied";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    const me = await client.organization.me();
    return { session, me };
  },
});

function AuthLayout() {
  const { me } = Route.useRouteContext();

  if (!me.membership) {
    return (
      <Denied
        message="The agent panel requires an invitation to an organization. Ask an owner or admin to invite you."
        title="No agent workspace"
      />
    );
  }

  if (me.membership.role === "owner" || me.membership.role === "admin") {
    return (
      <Denied
        message="This panel is for agents. Owners and admins use the console."
        title="Agents only"
      />
    );
  }

  return <Outlet />;
}
