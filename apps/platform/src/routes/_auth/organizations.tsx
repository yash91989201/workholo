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
import { Input } from "@workholo/ui/components/input";
import { Label } from "@workholo/ui/components/label";
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

function OrganizationsPage() {
  const { queryClient } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [userId, setUserId] = useState("");

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

  const suspend = useMutation(
    orpc.platform.suspendOrganization.mutationOptions()
  );
  const restore = useMutation(
    orpc.platform.restoreOrganization.mutationOptions()
  );
  const remove = useMutation(
    orpc.platform.deleteOrganization.mutationOptions()
  );

  const closeDialog = () => {
    setDialog(null);
    setReason("");
    setUserId("");
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
                        setReason("");
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
                      setUserId("");
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
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Input
              id="suspend-reason"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
          </div>
          <DialogFooter>
            <Button onClick={closeDialog} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!reason.trim() || suspend.isPending}
              onClick={() => {
                if (!dialog) {
                  return;
                }
                suspend.mutate(
                  { organizationId: dialog.id, reason },
                  {
                    onSuccess: () => {
                      toast.success(`Suspended ${dialog.name}`);
                      closeDialog();
                      invalidate();
                    },
                    onError: (error) => toast.error(error.message),
                  }
                );
              }}
              variant="destructive"
            >
              Suspend
            </Button>
          </DialogFooter>
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
          <div className="space-y-2">
            <Label htmlFor="impersonate-user">User id</Label>
            <Input
              id="impersonate-user"
              onChange={(event) => setUserId(event.target.value)}
              value={userId}
            />
          </div>
          <DialogFooter>
            <Button onClick={closeDialog} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!userId.trim()}
              onClick={() => {
                authClient.admin.impersonateUser(
                  { userId: userId.trim() },
                  {
                    onSuccess: () => window.location.reload(),
                    onError: (error) => {
                      toast.error(
                        error.error.message || error.error.statusText
                      );
                    },
                  }
                );
              }}
            >
              Impersonate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
