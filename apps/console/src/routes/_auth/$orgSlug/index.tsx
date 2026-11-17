import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workholo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";

export const Route = createFileRoute("/_auth/$orgSlug/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session, membership } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-bold text-2xl">Dashboard</h1>

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
