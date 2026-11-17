import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

const RouteSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: RouteSearchSchema,
});

function RouteComponent() {
  const { redirect } = Route.useSearch();
  const [showSignIn, setShowSignIn] = useState(false);

  return showSignIn ? (
    <SignInForm
      onSwitchToSignUp={() => setShowSignIn(false)}
      redirectTo={redirect}
    />
  ) : (
    <SignUpForm
      onSwitchToSignIn={() => setShowSignIn(true)}
      redirectTo={redirect}
    />
  );
}
