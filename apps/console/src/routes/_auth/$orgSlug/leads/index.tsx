import { IconDots } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { LeadListRow } from "@workholo/api-client";
import { Badge } from "@workholo/ui/components/badge";
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
import { useState } from "react";
import { toast } from "sonner";

import {
  CreateLeadListFormSchema,
  UpdateLeadListFormSchema,
} from "@/lib/schemas/lead";
import type {
  CreateLeadListFormType,
  UpdateLeadListFormType,
} from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/leads/")({
  component: LeadListsPage,
});

const createLeadListFormOpts = formOptions({
  defaultValues: {
    name: "",
    description: "",
  } satisfies CreateLeadListFormType as CreateLeadListFormType,
});

function CreateLeadListForm({
  organizationId,
  onDone,
}: {
  organizationId: string;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const createList = useMutation({
    ...orpc.leads.createLeadList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      onDone();
      await queryClient.invalidateQueries({ queryKey: orpc.leads.key() });
    },
  });
  const form = useAppForm({
    ...createLeadListFormOpts,
    validators: {
      onSubmit: CreateLeadListFormSchema,
    },
    onSubmit: ({ value }) => {
      createList.mutate({
        organizationId,
        name: value.name.trim(),
        description: value.description.trim() || undefined,
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
          {(field) => (
            <field.Input label="List name" placeholder="Spring campaign" />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea
              description="Optional. What this list is for."
              label="Description"
            />
          )}
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
                Create list
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

const renameLeadListFormOpts = formOptions({
  defaultValues: {
    name: "",
    description: "",
  } satisfies UpdateLeadListFormType as UpdateLeadListFormType,
});

function RenameLeadListForm({
  organizationId,
  list,
  onDone,
}: {
  organizationId: string;
  list: LeadListRow;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const updateList = useMutation({
    ...orpc.leads.updateLeadList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      onDone();
      await queryClient.invalidateQueries({ queryKey: orpc.leads.key() });
    },
  });
  const form = useAppForm({
    ...renameLeadListFormOpts,
    defaultValues: {
      name: list.name,
      description: list.description ?? "",
    },
    validators: {
      onSubmit: UpdateLeadListFormSchema,
    },
    onSubmit: ({ value }) => {
      updateList.mutate({
        organizationId,
        listId: list.id,
        name: value.name.trim(),
        description: value.description.trim() || null,
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
          {(field) => <field.Input label="List name" />}
        </form.AppField>
        <form.AppField name="description">
          {(field) => <field.Textarea label="Description" />}
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

function LeadListsPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const lists = useQuery(
    orpc.leads.listLeadLists.queryOptions({ input: { organizationId } })
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<LeadListRow | null>(null);
  const [archiving, setArchiving] = useState<LeadListRow | null>(null);

  const archiveList = useMutation({
    ...orpc.leads.archiveLeadList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setArchiving(null);
      await queryClient.invalidateQueries({ queryKey: orpc.leads.key() });
    },
  });

  const columns: ColumnDef<LeadListRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "leadCount", header: "Leads" },
    {
      cell: ({ row }) =>
        row.original.archivedAt ? (
          <Badge variant="outline">Archived</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        ),
      header: "Status",
      id: "status",
    },
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
            <IconDots />
            <span className="sr-only">Open actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={
                <Link
                  params={{ orgSlug: slug, listId: row.original.id }}
                  to="/$orgSlug/leads/$listId"
                />
              }
            >
              Open list
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenaming(row.original)}>
              Rename
            </DropdownMenuItem>
            {row.original.archivedAt ? null : (
              <DropdownMenuItem
                onClick={() => setArchiving(row.original)}
                variant="destructive"
              >
                Archive
              </DropdownMenuItem>
            )}
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
          <h1 className="font-bold text-2xl">Lead lists</h1>
          <p className="text-muted-foreground text-sm">
            Groups of phone numbers you can work through.
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger render={<Button />}>New list</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a lead list</DialogTitle>
              <DialogDescription>
                Lists stay in this organization. Archive a list to stop using it
                without deleting its leads.
              </DialogDescription>
            </DialogHeader>
            <CreateLeadListForm
              onDone={() => setCreateOpen(false)}
              organizationId={organizationId}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={lists.data} />

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
            <DialogTitle>Rename lead list</DialogTitle>
          </DialogHeader>
          {renaming ? (
            <RenameLeadListForm
              list={renaming}
              onDone={() => setRenaming(null)}
              organizationId={organizationId}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null);
          }
        }}
        open={archiving !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiving?.name}?</DialogTitle>
            <DialogDescription>
              The list is kept for history, but it is no longer offered for
              campaigns or new leads.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={archiveList.isPending}
              onClick={() => {
                if (archiving) {
                  archiveList.mutate({ organizationId, listId: archiving.id });
                }
              }}
              variant="destructive"
            >
              Archive list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
