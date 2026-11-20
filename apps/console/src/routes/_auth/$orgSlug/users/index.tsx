import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workholo/ui/components/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/users/")({
  component: UsersPage,
});

type DirectoryRow = Awaited<
  ReturnType<typeof orpc.organization.directory.call>
>[number];

function UsersPage() {
  const { membership, queryClient, session } = Route.useRouteContext();
  const { organizationId } = membership;
  const directory = useQuery(
    orpc.organization.directory.queryOptions({
      input: { organizationId },
    })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.organization.key() });

  const changeRole = useMutation({
    mutationFn: async (vars: { memberId: string; role: string }) => {
      const { error } = await authClient.organization.updateMemberRole({
        ...vars,
        organizationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not change the role");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not remove the member");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: invalidate,
  });

  const columns: ColumnDef<DirectoryRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
      header: "Role",
    },
    {
      accessorKey: "teams",
      cell: ({ row }) =>
        row.original.teams.length ? row.original.teams.join(", ") : "—",
      header: "Teams",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Joined",
    },
    {
      cell: ({ row }) => {
        const member = row.original;
        const isSelf = member.userId === session.user.id;
        const canManage =
          membership.role === "owner"
            ? member.role === "admin" || member.role === "agent"
            : membership.role === "admin" && member.role === "agent";
        const canRemove = isSelf || canManage;
        if (!(canManage || canRemove)) {
          return null;
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="icon-sm" variant="ghost" />}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {membership.role === "owner" && member.role === "admin" ? (
                <DropdownMenuItem
                  onClick={() =>
                    changeRole.mutate({ memberId: member.id, role: "agent" })
                  }
                >
                  Make agent
                </DropdownMenuItem>
              ) : null}
              {membership.role === "owner" && member.role === "agent" ? (
                <DropdownMenuItem
                  onClick={() =>
                    changeRole.mutate({ memberId: member.id, role: "admin" })
                  }
                >
                  Make admin
                </DropdownMenuItem>
              ) : null}
              {canRemove ? (
                <DropdownMenuItem
                  onClick={() => removeMember.mutate(member.id)}
                  variant="destructive"
                >
                  Remove member
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">All users</h1>
          <p className="text-muted-foreground text-sm">
            Everyone in {membership.name}, whatever their role.
          </p>
        </div>
        <Button
          render={
            <Link
              params={{ orgSlug: membership.slug }}
              to="/$orgSlug/users/add"
            />
          }
        >
          Add user
        </Button>
      </div>
      <DataTable columns={columns} data={directory.data} />
    </div>
  );
}
