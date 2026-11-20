import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { TeamRow } from "@workholo/api-client";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
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
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { CreateTeamFormSchema, RenameTeamFormSchema } from "@/lib/schemas/team";
import type { CreateTeamFormType, RenameTeamFormType } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/teams/")({
  component: TeamsPage,
});

const createTeamFormOpts = formOptions({
  defaultValues: {
    name: "",
  } satisfies CreateTeamFormType as CreateTeamFormType,
});

function CreateTeamForm({
  organizationId,
  onDone,
}: {
  organizationId: string;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const form = useAppForm({
    ...createTeamFormOpts,
    validators: {
      onSubmit: CreateTeamFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.organization.createTeam({
        name: value.name,
        organizationId,
      });
      if (error) {
        toast.error(error.message ?? "Could not create the team");
        return;
      }
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.organization.key(),
      });
    },
  });

  return (
    <form.AppForm>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => <field.Input label="Team name" placeholder="Support" />}
        </form.AppField>
        <DialogFooter>
          <Button onClick={onDone} type="button" variant="outline">
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                Create team
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

function RenameTeamForm({
  organizationId,
  team,
  onDone,
}: {
  organizationId: string;
  team: TeamRow;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const renameTeamFormOpts = formOptions({
    defaultValues: {
      name: team.name,
    } satisfies RenameTeamFormType as RenameTeamFormType,
  });
  const form = useAppForm({
    ...renameTeamFormOpts,
    validators: {
      onSubmit: RenameTeamFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.organization.updateTeam({
        teamId: team.id,
        data: { name: value.name, organizationId },
      });
      if (error) {
        toast.error(error.message ?? "Could not rename the team");
        return;
      }
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.organization.key(),
      });
    },
  });

  return (
    <form.AppForm>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => <field.Input label="Team name" />}
        </form.AppField>
        <DialogFooter>
          <Button onClick={onDone} type="button" variant="outline">
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                Save
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

function TeamsPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const teams = useQuery(
    orpc.organization.teams.queryOptions({ input: { organizationId } })
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<TeamRow | null>(null);
  const [removing, setRemoving] = useState<TeamRow | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.organization.key() });

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
            <DropdownMenuItem onClick={() => setRenaming(row.original)}>
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
            <CreateTeamForm
              onDone={() => setCreateOpen(false)}
              organizationId={organizationId}
            />
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
          {renaming ? (
            <RenameTeamForm
              onDone={() => setRenaming(null)}
              organizationId={organizationId}
              team={renaming}
            />
          ) : null}
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
