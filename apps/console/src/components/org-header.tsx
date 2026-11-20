import { Link, useLocation } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workholo/ui/components/breadcrumb";
import { ModeToggle } from "@workholo/ui/components/mode-toggle";
import { Separator } from "@workholo/ui/components/separator";
import { SidebarTrigger } from "@workholo/ui/components/sidebar";
import { NavUser } from "./sidebar/nav-user";

const pageLabels: Record<string, string> = {
  add: "Add user",
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
  const last = segments.at(-1);
  if (!last) {
    return "Dashboard";
  }
  if (segments[0] === "teams" && last !== "members" && last !== "teams") {
    return "Team";
  }
  return pageLabels[last] ?? "Dashboard";
}

type OrgHeaderProps = {
  org: { name: string; slug: string; role: string };
  user: { name: string; email: string; image?: string | null };
};

export function OrgHeader({ org, user }: OrgHeaderProps) {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mr-2 data-[orientation=vertical]:h-4"
          orientation="vertical"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                render={<Link params={{ orgSlug: org.slug }} to="/$orgSlug" />}
              >
                {org.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPage(pathname, org.slug)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <NavUser org={org} user={user} />
      </div>
    </header>
  );
}
