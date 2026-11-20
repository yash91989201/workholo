import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workholo/ui/components/dialog";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { Input } from "@workholo/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workholo/ui/components/table";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { SuspendOrganizationFormSchema } from "@/lib/schemas/organization";
import { ImpersonateUserFormSchema } from "@/lib/schemas/user";
import type {
  ImpersonateUserFormType,
  SuspendOrganizationFormType,
} from "@/lib/types";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_auth/organizations")({
  component: OrganizationsPage,
});

type DialogState =
  | { kind: "suspend"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | { kind: "impersonate"; id: string; name: string }
  | null;

const suspendOrganizationFormOpts = formOptions({
  defaultValues: {
    reason: "",
  } satisfies SuspendOrganizationFormType as SuspendOrganizationFormType,
});

function SuspendOrganizationForm({
  organization,
  onDone,
}: {
  organization: { id: string; name: string };
  onDone: () => void;
}) {
  const { queryClient } = Route.useRouteContext();
  const suspend = useMutation({
    ...orpc.platform.suspendOrganization.mutationOptions(),
    onSuccess: () => {
      toast.success(`Suspended ${organization.name}`);
      onDone();
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });
  const form = useAppForm({
    ...suspendOrganizationFormOpts,
    validators: {
      onSubmit: SuspendOrganizationFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await suspend.mutateAsync({
          organizationId: organization.id,
          reason: value.reason,
        });
      } catch {
        // Rejection is surfaced by the mutation's onError.
      }
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
        <form.AppField name="reason">
          {(field) => <field.Input label="Reason" />}
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
              <Button
                disabled={!canSubmit || isSubmitting || suspend.isPending}
                type="submit"
                variant="destructive"
              >
                Suspend
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

const impersonateUserFormOpts = formOptions({
  defaultValues: {
    userId: "",
  } satisfies ImpersonateUserFormType as ImpersonateUserFormType,
});

function ImpersonateUserForm({ onDone }: { onDone: () => void }) {
  const form = useAppForm({
    ...impersonateUserFormOpts,
    validators: {
      onSubmit: ImpersonateUserFormSchema,
    },
    onSubmit: async ({ value }) => {
      authClient.admin.impersonateUser(
        { userId: value.userId.trim() },
        {
          onSuccess: () => window.location.reload(),
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
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
        <form.AppField name="userId">
          {(field) => <field.Input label="User id" />}
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
                Impersonate
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </form.AppForm>
  );
}

function OrganizationsPage() {
  const { queryClient } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);

  const organizations = useQuery(
    orpc.platform.listOrganizations.queryOptions({
      input: {
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
    })
  );

  const invalidate = () => queryClient.invalidateQueries();

  const restore = useMutation(
    orpc.platform.restoreOrganization.mutationOptions()
  );
  const remove = useMutation(
    orpc.platform.deleteOrganization.mutationOptions()
  );

  const closeDialog = () => {
    setDialog(null);
  };

  const totalPages = Math.max(
    1,
    Math.ceil((organizations.data?.total ?? 0) / PAGE_SIZE)
  );

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">Organizations</h1>
        <Input
          className="max-w-xs"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search name or slug"
          value={search}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.data?.items.map((organization) => (
            <TableRow key={organization.id}>
              <TableCell className="font-medium">{organization.name}</TableCell>
              <TableCell>{organization.slug}</TableCell>
              <TableCell>{organization.memberCount}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    organization.status === "suspended"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {organization.status}
                </Badge>
                {organization.suspendedReason ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {organization.suspendedReason}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                {new Date(String(organization.createdAt)).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {organization.status === "suspended" ? (
                    <Button
                      onClick={() => {
                        restore.mutate(
                          { organizationId: organization.id },
                          {
                            onSuccess: () => {
                              toast.success(`Restored ${organization.name}`);
                              invalidate();
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        );
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setDialog({
                          kind: "suspend",
                          id: organization.id,
                          name: organization.name,
                        });
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Suspend
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setDialog({
                        kind: "impersonate",
                        id: organization.id,
                        name: organization.name,
                      });
                    }}
                    size="xs"
                    variant="outline"
                  >
                    Impersonate
                  </Button>
                  <Button
                    onClick={() => {
                      setDialog({
                        kind: "delete",
                        id: organization.id,
                        name: organization.name,
                      });
                    }}
                    size="xs"
                    variant="destructive"
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {organizations.data?.items.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={6}
              >
                No organizations found
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-sm">
          Page {organizations.data?.page ?? page} of {totalPages} ·{" "}
          {organizations.data?.total ?? 0} organizations
        </span>
        <Button
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
          size="sm"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={page >= totalPages}
          onClick={() => setPage((current) => current + 1)}
          size="sm"
          variant="outline"
        >
          Next
        </Button>
      </div>

      <Dialog
        onOpenChange={(open) => !open && closeDialog()}
        open={dialog?.kind === "suspend"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend organization</DialogTitle>
            <DialogDescription>
              Suspend {dialog?.name} and record a reason.
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "suspend" ? (
            <SuspendOrganizationForm
              onDone={closeDialog}
              organization={{ id: dialog.id, name: dialog.name }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && closeDialog()}
        open={dialog?.kind === "delete"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              Permanently delete {dialog?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={closeDialog} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={() => {
                if (!dialog) {
                  return;
                }
                remove.mutate(
                  { organizationId: dialog.id },
                  {
                    onSuccess: () => {
                      toast.success(`Deleted ${dialog.name}`);
                      closeDialog();
                      invalidate();
                    },
                    onError: (error) => toast.error(error.message),
                  }
                );
              }}
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && closeDialog()}
        open={dialog?.kind === "impersonate"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate user</DialogTitle>
            <DialogDescription>
              Enter the id of the user to impersonate.
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "impersonate" ? (
            <ImpersonateUserForm onDone={closeDialog} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
