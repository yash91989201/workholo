import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  // Client-only: the session check needs the browser cookie.
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    throw redirect({ to: session.data ? "/dashboard" : "/login" });
  },
});
