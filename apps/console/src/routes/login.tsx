import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/redirect";

const RouteSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: RouteSearchSchema,
  // Client-only: the session check needs the browser cookie.
  ssr: false,
  beforeLoad: async ({ search }) => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const [showSignIn, setShowSignIn] = useState(true);
  const target = safeRedirect(redirectTo);

  return showSignIn ? (
    <SignInForm
      onSwitchToSignUp={() => setShowSignIn(false)}
      redirectTo={target}
    />
  ) : (
    <SignUpForm
      onSwitchToSignIn={() => setShowSignIn(true)}
      redirectTo={target}
    />
  );
}
