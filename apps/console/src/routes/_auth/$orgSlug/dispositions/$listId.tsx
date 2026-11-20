import { IconArrowLeft, IconDots } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { DispositionEntryRow } from "@workholo/api-client";
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
  AddDispositionEntryFormSchema,
  UpdateDispositionListFormSchema,
} from "@/lib/schemas/disposition";
import type {
  AddDispositionEntryFormType,
  UpdateDispositionListFormType,
} from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/dispositions/$listId")({
  component: DispositionListDetailPage,
});

const addEntryFormOpts = formOptions({
  defaultValues: {
    code: "",
    label: "",
  } satisfies AddDispositionEntryFormType as AddDispositionEntryFormType,
});

function AddDispositionEntryForm({
  organizationId,
  listId,
}: {
  organizationId: string;
  listId: string;
}) {
  const { queryClient } = Route.useRouteContext();
  const addEntry = useMutation(
    orpc.dispositions.addDispositionEntry.mutationOptions()
  );
  const form = useAppForm({
    ...addEntryFormOpts,
    validators: {
      onSubmit: AddDispositionEntryFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await addEntry.mutateAsync({
          organizationId,
          listId,
          code: value.code.trim(),
          label: value.label.trim(),
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add the entry"
        );
        return;
      }
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: orpc.dispositions.key(),
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
        <form.AppField name="code">
          {(field) => (
            <field.Input
              description="Uppercase snake-case, for example NOT_INTERESTED"
              label="Code"
              placeholder="NOT_INTERESTED"
            />
          )}
        </form.AppField>
        <form.AppField name="label">
          {(field) => (
            <field.Input label="Label" placeholder="Not interested" />
          )}
        </form.AppField>
        <DialogFooter>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                Add entry
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
  description,
  listId,
  name,
  onDone,
  organizationId,
}: {
  description: string | null;
  listId: string;
  name: string;
  onDone: () => void;
  organizationId: string;
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
      name,
      description: description ?? "",
    },
    validators: {
      onSubmit: UpdateDispositionListFormSchema,
    },
    onSubmit: ({ value }) => {
      updateList.mutate({
        organizationId,
        listId,
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

function DispositionListDetailPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const { listId } = Route.useParams();
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [retiring, setRetiring] = useState<DispositionEntryRow | null>(null);

  const list = useQuery(
    orpc.dispositions.getDispositionList.queryOptions({
      input: { organizationId, listId },
    })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.dispositions.key() });

  const retireEntry = useMutation({
    ...orpc.dispositions.retireDispositionEntry.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setRetiring(null);
      await invalidate();
    },
  });

  const archiveList = useMutation({
    ...orpc.dispositions.archiveDispositionList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setArchiving(false);
      await invalidate();
    },
  });

  const archived = Boolean(list.data?.archivedAt);

  const columns: ColumnDef<DispositionEntryRow>[] = [
    {
      accessorKey: "code",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
      header: "Code",
    },
    { accessorKey: "label", header: "Label" },
    {
      cell: ({ row }) =>
        row.original.retiredAt ? (
          <Badge variant="outline">Retired</Badge>
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
      cell: ({ row }) =>
        archived || row.original.retiredAt ? null : (
          <Button
            onClick={() => setRetiring(row.original)}
            size="sm"
            variant="ghost"
          >
            Retire
          </Button>
        ),
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <Button
        render={<Link params={{ orgSlug: slug }} to="/$orgSlug/dispositions" />}
        size="sm"
        variant="ghost"
      >
        <IconArrowLeft /> All disposition lists
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl">
            {list.data?.name ?? "Disposition list"}
          </h1>
          {list.data?.description ? (
            <p className="text-muted-foreground text-sm">
              {list.data.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {archived ? null : (
            <>
              <Button onClick={() => setAddOpen(true)} variant="outline">
                Add entry
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button size="icon" variant="outline" />}
                >
                  <IconDots />
                  <span className="sr-only">Open actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRenaming(true)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setArchiving(true)}
                    variant="destructive"
                  >
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {archived ? (
            <Button onClick={() => setRenaming(true)} variant="outline">
              Rename
            </Button>
          ) : null}
        </div>
      </div>

      {archived ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          This list is archived. New entries cannot be added, but logged entries
          stay resolvable so past calls keep their outcome.
        </div>
      ) : null}

      <DataTable columns={columns} data={list.data?.entries} />

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an entry</DialogTitle>
            <DialogDescription>
              The code is permanent once an entry is created. Retire the entry
              instead of deleting it.
            </DialogDescription>
          </DialogHeader>
          <AddDispositionEntryForm
            listId={listId}
            organizationId={organizationId}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(false);
          }
        }}
        open={renaming}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename disposition list</DialogTitle>
          </DialogHeader>
          {list.data ? (
            <RenameDispositionListForm
              description={list.data.description}
              listId={listId}
              name={list.data.name}
              onDone={() => setRenaming(false)}
              organizationId={organizationId}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setArchiving} open={archiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {list.data?.name}?</DialogTitle>
            <DialogDescription>
              The list is kept for history. Past calls still resolve their
              codes, but the list is no longer offered when working a call.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={archiveList.isPending}
              onClick={() => archiveList.mutate({ organizationId, listId })}
              variant="destructive"
            >
              Archive list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRetiring(null);
          }
        }}
        open={retiring !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire {retiring?.code}?</DialogTitle>
            <DialogDescription>
              The entry stays resolvable for past calls but is no longer offered
              when working a call. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={retireEntry.isPending}
              onClick={() => {
                if (retiring) {
                  retireEntry.mutate({
                    organizationId,
                    listId,
                    entryId: retiring.id,
                  });
                }
              }}
              variant="destructive"
            >
              Retire entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
