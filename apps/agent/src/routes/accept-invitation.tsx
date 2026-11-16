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
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/accept-invitation")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
        search: { redirect: `/accept-invitation?id=${search.id ?? ""}` },
      });
    }
  },
});

function RouteComponent() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);

  if (!id) {
    return (
      <div className="container mx-auto max-w-xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              The invitation link is missing its id.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Join organization</CardTitle>
          <CardDescription>
            Accept the invitation to start taking calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={isPending}
            onClick={async () => {
              setIsPending(true);
              await authClient.organization.acceptInvitation(
                { invitationId: id },
                {
                  onSuccess: () => {
                    toast.success("Invitation accepted");
                    navigate({ to: "/panel" });
                  },
                  onError: (error) => {
                    toast.error(error.error.message || error.error.statusText);
                    setIsPending(false);
                  },
                }
              );
            }}
          >
            {isPending ? "Accepting…" : "Accept invitation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
