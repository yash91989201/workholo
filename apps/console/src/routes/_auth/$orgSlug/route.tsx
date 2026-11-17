import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@workholo/ui/components/sidebar";

import { OrgHeader } from "@/components/org-header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

export const Route = createFileRoute("/_auth/$orgSlug")({
  beforeLoad: ({ context, params }) => {
    if (params.orgSlug !== context.membership.slug) {
      throw redirect({
        to: "/$orgSlug",
        params: { orgSlug: context.membership.slug },
      });
    }
  },
  component: OrgLayout,
});

function OrgLayout() {
  const { membership, session } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <AppSidebar membership={membership} />
      <SidebarInset>
        <OrgHeader org={membership} user={session.user} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          {membership.suspendedAt ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
              This organization is suspended. Management actions are disabled
              until a platform admin restores it.
            </div>
          ) : null}
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
