import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import { Input } from "@workholo/ui/components/input";
import { Label } from "@workholo/ui/components/label";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

/** Kebab case: lowercase words joined by single hyphens; a trailing hyphen is
 * kept while typing so the next word can follow. */
function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

export const Route = createFileRoute("/onboarding")({
  // Client-only: the session check needs the browser cookie.
  ssr: false,
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login", search: { redirect: "/onboarding" } });
    }
    const me = await context.queryClient.ensureQueryData(
      context.orpc.organization.me.queryOptions()
    );
    if (me.membership) {
      throw redirect({
        to: "/$orgSlug/dashboard",
        params: { orgSlug: me.membership.slug },
      });
    }
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(undefined);
      const { error } = await authClient.organization.create({
        name: value.name,
        slug: value.slug,
      });
      if (error) {
        setFormError(error.message ?? "Could not create the organization.");
        return;
      }
      // ensureQueryData elsewhere returns stale-null membership otherwise.
      await queryClient.fetchQuery(orpc.organization.me.queryOptions());
      await navigate({
        to: "/$orgSlug/dashboard",
        params: { orgSlug: value.slug },
      });
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        slug: z
          .string()
          .min(2, "Slug must be at least 2 characters")
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Use kebab case: lowercase words joined by single hyphens"
          ),
      }),
    },
  });

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            You are not part of an organization yet. Create one to start using
            the console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Organization name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p className="text-red-500" key={error?.message}>
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="slug">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Slug</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(toKebabCase(e.target.value))
                    }
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p className="text-red-500" key={error?.message}>
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            {formError ? (
              <p className="text-red-500 text-sm">{formError}</p>
            ) : null}

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  className="w-full"
                  disabled={!canSubmit || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating..." : "Create organization"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
