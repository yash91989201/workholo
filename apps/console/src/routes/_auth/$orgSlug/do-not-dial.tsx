import { IconTrash } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { DoNotDialEntryRow } from "@workholo/api-client";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { toast } from "sonner";

import { AddDoNotDialEntryFormSchema } from "@/lib/schemas/do-not-dial";
import type { AddDoNotDialEntryFormType } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/do-not-dial")({
  component: DoNotDialPage,
});

const addEntryFormOpts = formOptions({
  defaultValues: {
    number: "",
  } satisfies AddDoNotDialEntryFormType as AddDoNotDialEntryFormType,
});

function AddDoNotDialEntryForm({ organizationId }: { organizationId: string }) {
  const { queryClient } = Route.useRouteContext();
  const addEntry = useMutation(
    orpc.doNotDial.addDoNotDialEntry.mutationOptions()
  );
  const form = useAppForm({
    ...addEntryFormOpts,
    validators: {
      onSubmit: AddDoNotDialEntryFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await addEntry.mutateAsync({
          organizationId,
          number: value.number.trim(),
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add the number"
        );
        return;
      }
      form.reset();
      await queryClient.invalidateQueries({ queryKey: orpc.doNotDial.key() });
    },
  });

  return (
    <form.AppForm>
      <form
        className="flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="flex-1">
          <form.AppField name="number">
            {(field) => (
              <field.Input
                description="Explicit country code, for example +14155550123"
                label="Phone number"
                placeholder="+14155550123"
              />
            )}
          </form.AppField>
        </div>
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              Add number
            </Button>
          )}
        </form.Subscribe>
      </form>
    </form.AppForm>
  );
}

function DoNotDialPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId } = membership;
  const entries = useQuery(
    orpc.doNotDial.listDoNotDialEntries.queryOptions({
      input: { organizationId },
    })
  );
  const removeEntry = useMutation({
    ...orpc.doNotDial.removeDoNotDialEntry.mutationOptions(),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.doNotDial.key() });
    },
  });

  const columns: ColumnDef<DoNotDialEntryRow>[] = [
    { accessorKey: "number", header: "Number" },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      header: "Added",
    },
    {
      cell: ({ row }) => (
        <Button
          aria-label={`Remove ${row.original.number}`}
          disabled={removeEntry.isPending}
          onClick={() =>
            removeEntry.mutate({
              organizationId,
              entryId: row.original.id,
            })
          }
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <IconTrash />
        </Button>
      ),
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Do not dial</h1>
        <p className="text-muted-foreground text-sm">
          Numbers in this set stay in this organization's suppression list.
        </p>
      </div>

      <AddDoNotDialEntryForm organizationId={organizationId} />

      <DataTable columns={columns} data={entries.data} />
    </div>
  );
}
