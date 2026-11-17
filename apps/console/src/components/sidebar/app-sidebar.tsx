import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@workholo/ui/components/sidebar";
import { LayoutDashboardIcon, UsersIcon, UsersRoundIcon } from "lucide-react";

import { type NavEntry, NavMain } from "./nav-main";
import { TeamSwitcher } from "./team-switcher";

type AppSidebarProps = {
  membership: { name: string; slug: string; role: string };
};

const navMain: NavEntry[] = [
  {
    title: "Dashboard",
    to: "/$orgSlug",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Users",
    icon: UsersIcon,
    items: [
      { title: "All users", to: "/$orgSlug/users" },
      { title: "Add user", to: "/$orgSlug/users/add" },
      { title: "Pending", to: "/$orgSlug/users/pending" },
    ],
  },
  {
    title: "Teams",
    icon: UsersRoundIcon,
    items: [
      { title: "Teams", to: "/$orgSlug/teams" },
      { title: "Members", to: "/$orgSlug/teams/members" },
    ],
  },
];

export function AppSidebar({ membership }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <TeamSwitcher team={membership} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} orgSlug={membership.slug} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
