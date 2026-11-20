import { IconDots } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { DispositionListRow } from "@workholo/api-client";
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
  CreateDispositionListFormSchema,
  UpdateDispositionListFormSchema,
} from "@/lib/schemas/disposition";
import type {
  CreateDispositionListFormType,
  UpdateDispositionListFormType,
} from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/dispositions/")({
  component: DispositionListsPage,
});

const createDispositionListFormOpts = formOptions({
  defaultValues: {
    name: "",
    description: "",
  } satisfies CreateDispositionListFormType as CreateDispositionListFormType,
});

function CreateDispositionListForm({
  organizationId,
  onDone,
}: {
  organizationId: string;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const createList = useMutation({
    ...orpc.dispositions.createDispositionList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.dispositions.key(),
      });
    },
  });
  const form = useAppForm({
    ...createDispositionListFormOpts,
    validators: {
      onSubmit: CreateDispositionListFormSchema,
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
            <field.Input label="List name" placeholder="Outbound outcomes" />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea
              description="Optional. What these outcomes describe."
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

const renameDispositionListFormOpts = formOptions({
  defaultValues: {
    name: "",
    description: "",
  } satisfies UpdateDispositionListFormType as UpdateDispositionListFormType,
});

function RenameDispositionListForm({
  organizationId,
  list,
  onDone,
}: {
  organizationId: string;
  list: DispositionListRow;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const updateList = useMutation({
    ...orpc.dispositions.updateDispositionList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      onDone();
      await queryClient.invalidateQueries({
        queryKey: orpc.dispositions.key(),
      });
    },
  });
  const form = useAppForm({
    ...renameDispositionListFormOpts,
    defaultValues: {
      name: list.name,
      description: list.description ?? "",
    },
    validators: {
      onSubmit: UpdateDispositionListFormSchema,
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

function DispositionListsPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const lists = useQuery(
    orpc.dispositions.listDispositionLists.queryOptions({
      input: { organizationId },
    })
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<DispositionListRow | null>(null);
  const [archiving, setArchiving] = useState<DispositionListRow | null>(null);

  const archiveList = useMutation({
    ...orpc.dispositions.archiveDispositionList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setArchiving(null);
      await queryClient.invalidateQueries({
        queryKey: orpc.dispositions.key(),
      });
    },
  });

  const columns: ColumnDef<DispositionListRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "entryCount", header: "Entries" },
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
                  to="/$orgSlug/dispositions/$listId"
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
          <h1 className="font-bold text-2xl">Disposition lists</h1>
          <p className="text-muted-foreground text-sm">
            Coded call outcomes agents pick when finishing a call.
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger render={<Button />}>New list</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a disposition list</DialogTitle>
              <DialogDescription>
                Lists stay in this organization. Archive a list to stop using it
                without losing the history recorded against its entries.
              </DialogDescription>
            </DialogHeader>
            <CreateDispositionListForm
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
            <DialogTitle>Rename disposition list</DialogTitle>
          </DialogHeader>
          {renaming ? (
            <RenameDispositionListForm
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
              The list is kept for history. Past calls still resolve their
              codes, but the list is no longer offered when working a call.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={archiveList.isPending}
              onClick={() => {
                if (archiving) {
                  archiveList.mutate({
                    organizationId,
                    listId: archiving.id,
                  });
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
