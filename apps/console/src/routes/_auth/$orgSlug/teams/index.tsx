import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { TeamRow } from "@workholo/api-client";
import { Button } from "@workholo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workholo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workholo/ui/components/dropdown-menu";
import { Input } from "@workholo/ui/components/input";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/teams/")({
  component: TeamsPage,
});

function TeamsPage() {
  const { membership } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const queryClient = useQueryClient();
  const teams = useQuery(
    orpc.organization.teams.queryOptions({ input: { organizationId } })
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<TeamRow | null>(null);
  const [removing, setRemoving] = useState<TeamRow | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.organization.key() });

  const createTeam = useMutation({
    mutationFn: async (teamName: string) => {
      const { error } = await authClient.organization.createTeam({
        name: teamName,
        organizationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not create the team");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setCreateOpen(false);
      setName("");
      await invalidate();
    },
  });

  const renameTeam = useMutation({
    mutationFn: async (vars: { teamId: string; name: string }) => {
      const { error } = await authClient.organization.updateTeam({
        teamId: vars.teamId,
        data: { name: vars.name, organizationId },
      });
      if (error) {
        throw new Error(error.message ?? "Could not rename the team");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setRenaming(null);
      setName("");
      await invalidate();
    },
  });

  const removeTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await authClient.organization.removeTeam({
        teamId,
        organizationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not delete the team");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setRemoving(null);
      await invalidate();
    },
  });

  const columns: ColumnDef<TeamRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "memberCount", header: "Members" },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Created",
    },
    {
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="icon-sm" variant="ghost" />}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">Open actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={
                <Link
                  params={{ orgSlug: slug, teamId: row.original.id }}
                  to="/$orgSlug/teams/$teamId"
                />
              }
            >
              Open team
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setName(row.original.name);
                setRenaming(row.original);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setRemoving(row.original)}
              variant="destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Teams</h1>
          <p className="text-muted-foreground text-sm">
            Group agents so work can be assigned to a team.
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger render={<Button />}>New team</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a team</DialogTitle>
              <DialogDescription>
                Teams only hold agents, and an agent can belong to several
                teams.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createTeam.mutate(name);
              }}
            >
              <Input
                aria-label="Team name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Support"
                value={name}
              />
              <DialogFooter>
                <Button
                  disabled={name.trim().length === 0 || createTeam.isPending}
                  type="submit"
                >
                  Create team
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={teams.data} />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
          }
        }}
        open={renaming !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename team</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (renaming) {
                renameTeam.mutate({ teamId: renaming.id, name });
              }
            }}
          >
            <Input
              aria-label="Team name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
            <DialogFooter>
              <Button
                disabled={name.trim().length === 0 || renameTeam.isPending}
                type="submit"
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        open={removing !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {removing?.name}?</DialogTitle>
            <DialogDescription>
              The team and its team memberships are removed. Organization
              members keep their membership.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={removeTeam.isPending}
              onClick={() => {
                if (removing) {
                  removeTeam.mutate(removing.id);
                }
              }}
              variant="destructive"
            >
              Delete team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
