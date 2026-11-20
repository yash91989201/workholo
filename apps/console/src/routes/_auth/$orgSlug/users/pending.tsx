import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { InvitationRow } from "@workholo/api-client";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import { DataTable } from "@workholo/ui/components/data-table";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/users/pending")({
  component: PendingUsersPage,
});

function PendingUsersPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId } = membership;
  const invitations = useQuery(
    orpc.organization.invitations.queryOptions({
      input: { organizationId },
    })
  );

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (error) {
        throw new Error(error.message ?? "Could not cancel the invitation");
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orpc.organization.key() }),
  });

  const copyInviteLink = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the invite link");
    }
  };

  const columns: ColumnDef<InvitationRow>[] = [
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
      header: "Role",
    },
    {
      accessorKey: "teamName",
      cell: ({ row }) => row.original.teamName ?? "—",
      header: "Team",
    },
    {
      accessorKey: "expiresAt",
      cell: ({ row }) => new Date(row.original.expiresAt).toLocaleDateString(),
      header: "Expires",
    },
    {
      cell: ({ row }) => (
        <Button
          onClick={() => copyInviteLink(row.original.inviteUrl)}
          size="sm"
          variant="outline"
        >
          Copy link
        </Button>
      ),
      header: "",
      id: "copyLink",
    },
    {
      cell: ({ row }) => (
        <Button
          disabled={cancelInvitation.isPending}
          onClick={() => cancelInvitation.mutate(row.original.id)}
          size="sm"
          variant="destructive"
        >
          Cancel
        </Button>
      ),
      header: "",
      id: "actions",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Pending users</h1>
        <p className="text-muted-foreground text-sm">
          Invitations waiting to be accepted. Cancelled invitations can no
          longer be used.
        </p>
      </div>
      <DataTable columns={columns} data={invitations.data} />
    </div>
  );
}
