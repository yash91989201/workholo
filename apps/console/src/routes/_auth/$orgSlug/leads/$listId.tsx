import { IconArrowLeft, IconDots } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { ImportLeadRow, LeadRow } from "@workholo/api-client";
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
import { Input } from "@workholo/ui/components/input";
import { useState } from "react";
import { toast } from "sonner";

import {
  AddLeadFormSchema,
  ImportLeadsFormSchema,
  UpdateLeadListFormSchema,
} from "@/lib/schemas/lead";
import type {
  AddLeadFormType,
  ImportLeadsFormType,
  UpdateLeadListFormType,
} from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/leads/$listId")({
  component: LeadListDetailPage,
});

const addLeadFormOpts = formOptions({
  defaultValues: {
    phone: "",
    name: "",
  } satisfies AddLeadFormType as AddLeadFormType,
});

function AddLeadForm({
  organizationId,
  listId,
}: {
  organizationId: string;
  listId: string;
}) {
  const { queryClient } = Route.useRouteContext();
  const addLead = useMutation(orpc.leads.addLead.mutationOptions());
  const form = useAppForm({
    ...addLeadFormOpts,
    validators: {
      onSubmit: AddLeadFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await addLead.mutateAsync({
          organizationId,
          listId,
          phone: value.phone.trim(),
          name: value.name.trim() || undefined,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add the lead"
        );
        return;
      }
      form.reset();
      await queryClient.invalidateQueries({ queryKey: orpc.leads.key() });
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
        <form.AppField name="phone">
          {(field) => (
            <field.Input
              description="Include the country code, for example +14155550123."
              label="Phone number"
              placeholder="+14155550123"
            />
          )}
        </form.AppField>
        <form.AppField name="name">
          {(field) => <field.Input label="Name" placeholder="Optional" />}
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
                Add lead
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

const importLeadsFormOpts = formOptions({
  defaultValues: {
    csv: "",
  } satisfies ImportLeadsFormType as ImportLeadsFormType,
});

function ImportLeadsForm({
  organizationId,
  listId,
  onDone,
}: {
  organizationId: string;
  listId: string;
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const [rows, setRows] = useState<ImportLeadRow[]>([]);
  const importLeads = useMutation(orpc.leads.importLeads.mutationOptions());
  const form = useAppForm({
    ...importLeadsFormOpts,
    validators: {
      onSubmit: ImportLeadsFormSchema,
    },
    onSubmit: async ({ value }) => {
      let result: ImportLeadRow[];
      try {
        result = await importLeads.mutateAsync({
          organizationId,
          listId,
          csv: value.csv,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not import the CSV"
        );
        return;
      }
      const imported = result.filter((row) => row.status === "imported").length;
      setRows(result);
      toast.success(
        `${imported} imported, ${result.length - imported} skipped`
      );
      await queryClient.invalidateQueries({ queryKey: orpc.leads.key() });
    },
  });

  const columns: ColumnDef<ImportLeadRow>[] = [
    { accessorKey: "line", header: "Line" },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "name",
      cell: ({ row }) => row.original.name ?? "—",
      header: "Name",
    },
    { accessorKey: "status", header: "Status" },
    {
      accessorKey: "reason",
      cell: ({ row }) => row.original.reason ?? "—",
      header: "Reason",
    },
  ];

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
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="lead-csv">
            CSV file
          </label>
          <Input
            accept=".csv,text/csv"
            id="lead-csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              form.setFieldValue("csv", await file.text());
            }}
            type="file"
          />
          <p className="text-muted-foreground text-sm">
            The header row must include <code>phone</code> and may include{" "}
            <code>name</code>. Numbers must include a country code. Maximum 2000
            rows.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onDone} type="button" variant="outline">
            Close
          </Button>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                Import CSV
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
        {rows.length ? <DataTable columns={columns} data={rows} /> : null}
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
  description,
  name,
  onDone,
  listId,
  organizationId,
}: {
  description: string | null;
  name: string;
  onDone: () => void;
  listId: string;
  organizationId: string;
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
      name,
      description: description ?? "",
    },
    validators: {
      onSubmit: UpdateLeadListFormSchema,
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

function LeadListDetailPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, slug } = membership;
  const { listId } = Route.useParams();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [removing, setRemoving] = useState<LeadRow | null>(null);

  const list = useQuery(
    orpc.leads.getLeadList.queryOptions({
      input: { organizationId, listId },
    })
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.leads.key() });

  const removeLead = useMutation({
    ...orpc.leads.removeLead.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setRemoving(null);
      await invalidate();
    },
  });

  const archiveList = useMutation({
    ...orpc.leads.archiveLeadList.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      setArchiving(false);
      await invalidate();
    },
  });

  const archived = Boolean(list.data?.archivedAt);

  const leadColumns: ColumnDef<LeadRow>[] = [
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "name",
      cell: ({ row }) => row.original.name ?? "—",
      header: "Name",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Added",
    },
  ];

  const columns: ColumnDef<LeadRow>[] = archived
    ? leadColumns
    : [
        ...leadColumns,
        {
          cell: ({ row }) => (
            <Button
              onClick={() => setRemoving(row.original)}
              size="sm"
              variant="ghost"
            >
              Remove
            </Button>
          ),
          header: "",
          id: "actions",
        },
      ];

  return (
    <div className="space-y-4">
      <Button
        render={<Link params={{ orgSlug: slug }} to="/$orgSlug/leads" />}
        size="sm"
        variant="ghost"
      >
        <IconArrowLeft /> All lead lists
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl">
            {list.data?.name ?? "Lead list"}
          </h1>
          {list.data?.description ? (
            <p className="text-muted-foreground text-sm">
              {list.data.description}
            </p>
          ) : null}
        </div>
        {archived ? null : (
          <div className="flex items-center gap-2">
            <Button onClick={() => setImportOpen(true)} variant="outline">
              Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>Add lead</Button>
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
          </div>
        )}
      </div>

      {archived ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          This list is archived. Leads can still be viewed, but new leads cannot
          be added or imported.
        </div>
      ) : null}

      <DataTable columns={columns} data={list.data?.leads} />

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a lead</DialogTitle>
            <DialogDescription>
              Numbers must be explicit E.164, for example +14155550123.
            </DialogDescription>
          </DialogHeader>
          <AddLeadForm listId={listId} organizationId={organizationId} />
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setImportOpen(open);
        }}
        open={importOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import leads from CSV</DialogTitle>
            <DialogDescription>
              Every row is checked. Rows that cannot be imported stay listed
              with the reason.
            </DialogDescription>
          </DialogHeader>
          <ImportLeadsForm
            listId={listId}
            onDone={() => setImportOpen(false)}
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
            <DialogTitle>Rename lead list</DialogTitle>
          </DialogHeader>
          {list.data ? (
            <RenameLeadListForm
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
              The list is kept for history, but it is no longer offered for
              campaigns or new leads.
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
            setRemoving(null);
          }
        }}
        open={removing !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.phone}?</DialogTitle>
            <DialogDescription>
              The lead is removed from this list. Numbers can be added again
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              disabled={removeLead.isPending}
              onClick={() => {
                if (removing) {
                  removeLead.mutate({
                    organizationId,
                    listId,
                    leadId: removing.id,
                  });
                }
              }}
              variant="destructive"
            >
              Remove lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
