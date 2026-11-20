import {
  IconAddressBook,
  IconLayoutDashboard,
  IconListCheck,
  IconPhone,
  IconPhoneOff,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@workholo/ui/components/sidebar";

import { type NavEntry, NavMain } from "./nav-main";
import { TeamSwitcher } from "./team-switcher";

type AppSidebarProps = {
  membership: { name: string; slug: string; role: string };
};

const navMain: NavEntry[] = [
  {
    title: "Dashboard",
    to: "/$orgSlug",
    icon: IconLayoutDashboard,
  },
  {
    title: "Users",
    icon: IconUsers,
    items: [
      { title: "All users", to: "/$orgSlug/users" },
      { title: "Add user", to: "/$orgSlug/users/add" },
      { title: "Pending", to: "/$orgSlug/users/pending" },
    ],
  },
  {
    title: "Teams",
    icon: IconUsersGroup,
    items: [
      { title: "Teams", to: "/$orgSlug/teams" },
      { title: "Members", to: "/$orgSlug/teams/members" },
    ],
  },
  {
    title: "Leads",
    to: "/$orgSlug/leads",
    icon: IconAddressBook,
  },
  {
    title: "Dispositions",
    to: "/$orgSlug/dispositions",
    icon: IconListCheck,
  },
  {
    title: "Numbers",
    to: "/$orgSlug/numbers",
    icon: IconPhone,
  },
  {
    title: "Do not dial",
    to: "/$orgSlug/do-not-dial",
    icon: IconPhoneOff,
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
