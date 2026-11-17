import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

const RouteSearchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/accept-invitation")({
  validateSearch: RouteSearchSchema,
  // Client-only: the session check needs the browser cookie.
  ssr: false,
  beforeLoad: async ({ search }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/accept-invitation?id=${encodeURIComponent(search.id ?? "")}`,
        },
      });
    }
  },
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function acceptInvitation() {
    if (!id) {
      setError("This invitation link is missing its id.");
      return;
    }

    setIsPending(true);
    setError(undefined);
    const { error: acceptError } =
      await authClient.organization.acceptInvitation({
        invitationId: id,
      });
    setIsPending(false);

    if (acceptError) {
      setError(acceptError.message ?? "Could not accept the invitation.");
      return;
    }

    const me = await queryClient.fetchQuery(
      orpc.organization.me.queryOptions()
    );
    await queryClient.invalidateQueries();
    await navigate({
      to: "/$orgSlug",
      params: { orgSlug: me.membership?.slug ?? "" },
    });
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Accept invitation</CardTitle>
          <CardDescription>
            Join your organization in the workholo console. If you already
            belong to an organization, ask an owner to remove you first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button disabled={isPending} onClick={acceptInvitation}>
            {isPending ? "Accepting..." : "Accept invitation"}
          </Button>
          {error ? <p className="text-red-500 text-sm">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
