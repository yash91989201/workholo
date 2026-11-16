import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workholo/ui/components/alert-dialog";
import { Badge } from "@workholo/ui/components/badge";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import { Input } from "@workholo/ui/components/input";
import { Label } from "@workholo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workholo/ui/components/select";
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

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/members")({
  component: MembersPage,
});

type Role = "owner" | "admin" | "agent";

function toRole(role: string): Role {
  return role === "owner" || role === "admin" ? role : "agent";
}

/** Owner manages admins and agents; admins manage agents; nobody modifies the owner. */
function canManage(actor: Role, target: Role) {
  if (target === "owner") {
    return false;
  }
  return actor === "owner" || (actor === "admin" && target === "agent");
}

function MembersPage() {
  const { membership } = Route.useRouteContext();
  const { organizationId, role: membershipRole } = membership;
  const actorRole = toRole(membershipRole);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">(
    actorRole === "owner" ? "admin" : "agent"
  );
  const [isInviting, setIsInviting] = useState(false);

  const assignments: readonly ("admin" | "agent")[] =
    actorRole === "owner" ? ["admin", "agent"] : ["agent"];
  const invitationsKey = ["organization-invitations", organizationId] as const;

  const membersQuery = useQuery(
    orpc.organization.members.queryOptions({ input: { organizationId } })
  );
  const invitationsQuery = useQuery({
    queryKey: invitationsKey,
    queryFn: async () => {
      const result = await authClient.organization.listInvitations({
        query: { organizationId },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not load invitations");
      }
      return result.data ?? [];
    },
  });

  const pendingInvitations = invitationsQuery.data?.filter(
    (invitation) => invitation.status === "pending"
  );

  async function updateRole(memberId: string, role: string) {
    const { error } = await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not update the role");
      return;
    }
    toast.success("Role updated");
    await queryClient.invalidateQueries({
      queryKey: orpc.organization.members.queryKey({
        input: { organizationId },
      }),
    });
  }

  async function removeMember(memberId: string) {
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not remove the member");
      return;
    }
    toast.success("Member removed");
    await queryClient.invalidateQueries({
      queryKey: orpc.organization.members.queryKey({
        input: { organizationId },
      }),
    });
  }

  async function sendInvitation() {
    if (!email.trim()) {
      return;
    }
    setIsInviting(true);
    const { error } = await authClient.organization.inviteMember({
      email: email.trim(),
      role: inviteRole,
      organizationId,
    });
    setIsInviting(false);
    if (error) {
      toast.error(error.message ?? "Could not send the invitation");
      return;
    }
    setEmail("");
    toast.success("Invitation sent");
    await queryClient.invalidateQueries({ queryKey: invitationsKey });
  }

  async function cancelInvitation(invitationId: string) {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not cancel the invitation");
      return;
    }
    toast.success("Invitation cancelled");
    await queryClient.invalidateQueries({ queryKey: invitationsKey });
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="font-bold text-2xl">Members</h1>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            Roles determine what each person can access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersQuery.isPending ? <Loader /> : null}
          {membersQuery.error ? (
            <p className="text-red-500 text-sm">{membersQuery.error.message}</p>
          ) : null}
          {membersQuery.data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersQuery.data.map((member) => {
                  const targetRole = toRole(member.role);
                  const editable = canManage(actorRole, targetRole);
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-muted-foreground text-sm">
                          {member.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <Select
                            onValueChange={(value) => {
                              if (value) {
                                updateRole(member.id, value);
                              }
                            }}
                            value={targetRole}
                          >
                            <SelectTrigger className="w-28" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assignments.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{targetRole}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button size="sm" variant="destructive" />
                              }
                            >
                              Remove
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove member?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {member.name} will lose access to this
                                  organization.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogCancel
                                  onClick={() => removeMember(member.id)}
                                  variant="destructive"
                                >
                                  Remove
                                </AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            {actorRole === "owner"
              ? "You can invite admins and agents."
              : "You can invite agents."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendInvitation();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    setInviteRole(value as "admin" | "agent");
                  }
                }}
                value={inviteRole}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={isInviting} type="submit">
              {isInviting ? "Inviting..." : "Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            Sent invitations that have not been accepted yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsQuery.isPending ? <Loader /> : null}
          {invitationsQuery.error ? (
            <p className="text-red-500 text-sm">
              {invitationsQuery.error.message}
            </p>
          ) : null}
          {pendingInvitations && pendingInvitations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No pending invitations.
            </p>
          ) : null}
          {pendingInvitations && pendingInvitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invitation.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => cancelInvitation(invitation.id)}
                        size="sm"
                        variant="destructive"
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
