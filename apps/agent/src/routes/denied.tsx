import { createFileRoute } from "@tanstack/react-router";

import Denied from "@/components/denied";

export const Route = createFileRoute("/denied")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Denied
      message="Your account does not have access to the agent panel."
      title="Access denied"
    />
  );
}
