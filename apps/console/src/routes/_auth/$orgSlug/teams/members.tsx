import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { DirectoryRow } from "@workholo/api-client";
import { Badge } from "@workholo/ui/components/badge";
import { DataTable } from "@workholo/ui/components/data-table";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/teams/members")({
  component: TeamMembersPage,
});

function TeamMembersPage() {
  const { membership } = Route.useRouteContext();
  const directory = useQuery(
    orpc.organization.directory.queryOptions({
      input: { organizationId: membership.organizationId },
    })
  );

  const columns: ColumnDef<DirectoryRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
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
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Members</h1>
        <p className="text-muted-foreground text-sm">
          Owners, administrators, and agents in {membership.name}.
        </p>
      </div>
      <DataTable columns={columns} data={directory.data} />
    </div>
  );
}
