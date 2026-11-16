import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workholo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session, membership } = Route.useRouteContext();

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-bold text-2xl">Dashboard</h1>

      {membership.suspendedAt ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          This organization is suspended. Management actions are disabled until
          a platform admin restores it.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{membership.name}</CardTitle>
          <CardDescription>{membership.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Your role</dt>
              <dd>
                <Badge variant="secondary">{membership.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Signed in as</dt>
              <dd className="text-sm">
                {session.user.name} ({session.user.email})
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
