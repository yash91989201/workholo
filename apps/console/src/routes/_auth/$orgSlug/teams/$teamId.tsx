import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { TeamMemberRow } from "@workholo/api-client";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workholo/ui/components/select";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/teams/$teamId")({
  component: TeamDetailPage,
});

function TeamDetailPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const { teamId } = Route.useParams();
  const [selected, setSelected] = useState<string | null>(null);
  const team = useQuery(
    orpc.organization.teams.queryOptions({ input: { organizationId } })
  );
  const roster = useQuery(
    orpc.organization.teamMembers.queryOptions({
      input: { organizationId, teamId },
    })
  );
  const directory = useQuery(
    orpc.organization.directory.queryOptions({
      input: { organizationId },
    })
  );

  const addAgent = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await authClient.organization.addTeamMember({
        teamId,
        userId,
        organizationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not add the agent");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setSelected(null);
      await queryClient.invalidateQueries({
        queryKey: orpc.organization.key(),
      });
    },
  });

  const memberUserIds = new Set((roster.data ?? []).map((row) => row.userId));
  const availableAgents = (directory.data ?? []).filter(
    (row) => row.role === "agent" && !memberUserIds.has(row.userId)
  );
  const teamName = team.data?.find((row) => row.id === teamId)?.name;

  const columns: ColumnDef<TeamMemberRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Joined",
    },
  ];

  return (
    <div className="space-y-4">
      <Button
        render={<Link params={{ orgSlug: slug }} to="/$orgSlug/teams" />}
        size="sm"
        variant="ghost"
      >
        <ArrowLeftIcon /> All teams
      </Button>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl">{teamName ?? "Team"}</h1>
          <p className="text-muted-foreground text-sm">
            Agents assigned to this team.
          </p>
        </div>
        <Select
          items={availableAgents.map((row) => ({
            label: row.name,
            value: row.userId,
          }))}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSelected(value);
              addAgent.mutate(value);
            }
          }}
          value={selected}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add an agent" />
          </SelectTrigger>
          <SelectContent>
            {availableAgents.map((row) => (
              <SelectItem key={row.userId} value={row.userId}>
                {row.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={roster.data} />
    </div>
  );
}
