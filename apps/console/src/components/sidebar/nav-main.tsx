import { IconChevronRight, type TablerIcon } from "@tabler/icons-react";
import { Link, linkOptions, useLocation } from "@tanstack/react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workholo/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workholo/ui/components/sidebar";

export type OrgPath =
  | "/$orgSlug"
  | "/$orgSlug/users"
  | "/$orgSlug/users/add"
  | "/$orgSlug/users/pending"
  | "/$orgSlug/teams"
  | "/$orgSlug/teams/members"
  | "/$orgSlug/leads"
  | "/$orgSlug/dispositions";

export type NavEntry = {
  title: string;
  icon: TablerIcon;
  to?: OrgPath;
  items?: { title: string; to: OrgPath }[];
};

export function NavMain({
  items,
  orgSlug,
}: {
  items: NavEntry[];
  orgSlug: string;
}) {
  const { pathname } = useLocation();

  const navLink = (to: OrgPath) =>
    linkOptions({
      activeOptions: { exact: true },
      activeProps: { "data-active": "" },
      params: { orgSlug },
      to,
    });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Console</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          if (item.items) {
            const isOpen = item.items.some((subItem) =>
              pathname.startsWith(subItem.to.replace("$orgSlug", orgSlug))
            );
            return (
              <Collapsible defaultOpen={isOpen} key={item.title}>
                <SidebarMenuItem>
                  <CollapsibleTrigger
                    render={<SidebarMenuButton tooltip={item.title} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    <IconChevronRight className="ml-auto transition-transform duration-200 [[data-panel-open]_&]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            render={<Link {...navLink(subItem.to)} />}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }
          if (!item.to) {
            return null;
          }
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={<Link {...navLink(item.to)} />}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
