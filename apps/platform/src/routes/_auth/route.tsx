import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { PLATFORM_ADMIN_ROLE } from "@workholo/auth/roles";
import { Button } from "@workholo/ui/components/button";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  // Client-only: the session/role guard must not run during SSR.
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }

    const impersonating = Boolean(session.data.session.impersonatedBy);
    // Impersonated sessions carry the target user's role; keep them in so the stop banner shows.
    if (session.data.user.role !== PLATFORM_ADMIN_ROLE && !impersonating) {
      throw redirect({ to: "/denied" });
    }

    return { session: session.data };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  return (
    <>
      {session.session.impersonatedBy ? <ImpersonationBanner /> : null}
      <Outlet />
    </>
  );
}

function ImpersonationBanner() {
  return (
    <div className="flex items-center justify-between gap-2 bg-destructive/10 px-4 py-2 text-destructive text-sm">
      <span>Impersonating</span>
      <Button
        onClick={() => {
          authClient.admin.stopImpersonating({
            fetchOptions: {
              onSuccess: () => window.location.reload(),
              onError: (error) => {
                toast.error(error.error.message || error.error.statusText);
              },
            },
          });
        }}
        size="xs"
        variant="outline"
      >
        Stop
      </Button>
    </div>
  );
}
