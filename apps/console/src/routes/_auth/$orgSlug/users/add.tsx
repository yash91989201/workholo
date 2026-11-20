import { formOptions } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { SelectItem } from "@workholo/ui/components/select";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { InviteUserFormSchema } from "@/lib/schemas/user";
import type { InviteUserFormType } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/$orgSlug/users/add")({
  component: AddUserPage,
});

const inviteUserFormOpts = formOptions({
  defaultValues: {
    email: "",
    role: "agent",
    teamId: "",
  } satisfies InviteUserFormType as InviteUserFormType,
});

function AddUserPage() {
  const { membership, queryClient } = Route.useRouteContext();
  const { organizationId, role: actorRole, slug } = membership;
  const navigate = useNavigate();
  const teams = useQuery(
    orpc.organization.teams.queryOptions({ input: { organizationId } })
  );
  const roleItems = [
    ...(actorRole === "owner"
      ? [{ value: "admin", label: "Administrator" }]
      : []),
    { value: "agent", label: "Agent" },
  ];
  const teamItems = (teams.data ?? []).map((team) => ({
    value: team.id,
    label: team.name,
  }));

  const form = useAppForm({
    ...inviteUserFormOpts,
    defaultValues: {
      ...inviteUserFormOpts.defaultValues,
      role: actorRole === "owner" ? "admin" : "agent",
    },
    validators: {
      onSubmit: InviteUserFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.organization.inviteMember({
        email: value.email,
        organizationId,
        role: value.role,
        teamId: value.role === "agent" ? value.teamId : undefined,
      });
      if (error) {
        toast.error(error.message ?? "Could not send the invitation");
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.organization.key(),
      });
      toast.success(`Invitation sent to ${value.email}`);
      await navigate({
        to: "/$orgSlug/users/pending",
        params: { orgSlug: slug },
      });
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Add user</h1>
        <p className="text-muted-foreground text-sm">
          Invite an administrator or an agent to {membership.name}.
        </p>
      </div>
      <form.AppForm>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="email">
            {(field) => (
              <field.Input label="Email" placeholder="person@example.com" />
            )}
          </form.AppField>

          <form.AppField name="role">
            {(field) => (
              <field.Select items={roleItems} label="Role">
                {actorRole === "owner" ? (
                  <SelectItem value="admin">Administrator</SelectItem>
                ) : null}
                <SelectItem value="agent">Agent</SelectItem>
              </field.Select>
            )}
          </form.AppField>

          <form.Subscribe selector={(state) => state.values.role}>
            {(role) =>
              role === "agent" ? (
                <form.AppField name="teamId">
                  {(field) => (
                    <field.Select
                      items={teamItems}
                      label="Team"
                      placeholder="Choose a team"
                    >
                      {(teams.data ?? []).map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </field.Select>
                  )}
                </form.AppField>
              ) : null
            }
          </form.Subscribe>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                {isSubmitting ? "Inviting..." : "Send invitation"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </form.AppForm>
    </div>
  );
}
