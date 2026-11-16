import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";

export const Route = createFileRoute("/denied")({
  component: DeniedPage,
});

function DeniedPage() {
  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            This console is for organization owners and admins. Ask an owner to
            change your role if you need access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            If you believe this is a mistake, contact your organization owner.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
