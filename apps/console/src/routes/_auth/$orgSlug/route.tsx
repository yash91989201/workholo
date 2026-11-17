import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workholo/ui/components/breadcrumb";
import { Separator } from "@workholo/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workholo/ui/components/sidebar";

import { AppSidebar } from "@/components/sidebar/app-sidebar";

export const Route = createFileRoute("/_auth/$orgSlug")({
  beforeLoad: ({ context, params }) => {
    if (params.orgSlug !== context.membership.slug) {
      throw redirect({
        to: "/$orgSlug/dashboard",
        params: { orgSlug: context.membership.slug },
      });
    }
  },
  component: OrgLayout,
});

const pageLabels: Record<string, string> = {
  add: "Add user",
  dashboard: "Dashboard",
  members: "Members",
  pending: "Pending users",
  teams: "Teams",
  users: "All users",
};

function currentPage(pathname: string, orgSlug: string): string {
  const segments = pathname
    .replace(`/${orgSlug}`, "")
    .split("/")
    .filter(Boolean);
  const last = segments.at(-1) ?? "dashboard";
  if (segments[0] === "teams" && last !== "members" && last !== "teams") {
    return "Team";
  }
  return pageLabels[last] ?? "Dashboard";
}

function OrgLayout() {
  const { membership, session } = Route.useRouteContext();
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <AppSidebar membership={membership} user={session.user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mr-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink
                    render={
                      <Link
                        params={{ orgSlug: membership.slug }}
                        to="/$orgSlug/dashboard"
                      />
                    }
                  >
                    {membership.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {currentPage(pathname, membership.slug)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
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
