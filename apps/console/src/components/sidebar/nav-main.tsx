import { Link, useLocation } from "@tanstack/react-router";
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
import { ChevronRightIcon, type LucideIcon } from "lucide-react";

export type OrgPath =
  | "/$orgSlug/dashboard"
  | "/$orgSlug/users"
  | "/$orgSlug/users/add"
  | "/$orgSlug/users/pending"
  | "/$orgSlug/teams"
  | "/$orgSlug/teams/members";

export type NavEntry = {
  title: string;
  icon: LucideIcon;
  to?: OrgPath;
  items?: { title: string; to: OrgPath }[];
};

/** Link marks itself active; forward that to the sidebar's data-active styles. */
const activeProps = { "data-active": "" } as const;

export function NavMain({
  items,
  orgSlug,
}: {
  items: NavEntry[];
  orgSlug: string;
}) {
  const { pathname } = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
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
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 [[data-panel-open]_&]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            render={
                              <Link
                                activeProps={activeProps}
                                params={{ orgSlug }}
                                to={subItem.to}
                              />
                            }
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
                render={
                  <Link
                    activeProps={activeProps}
                    params={{ orgSlug }}
                    to={item.to}
                  />
                }
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
