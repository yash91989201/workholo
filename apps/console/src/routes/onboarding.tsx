import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { formOptions } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";
import {
  InputGroupAddon,
  InputGroupButton,
} from "@workholo/ui/components/form/form-input-group";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { CreateOrganizationFormSchema } from "@/lib/schemas/organization";
import type { CreateOrganizationFormType } from "@/lib/types";
import { orpc } from "@/utils/orpc";
import { generateSlug, normalizeSlugInput } from "@/utils/slug";

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
        to: "/$orgSlug",
        params: { orgSlug: me.membership.slug },
      });
    }
  },
  component: OnboardingPage,
});

const onboardingFormOpts = formOptions({
  defaultValues: {
    name: "",
    slug: "",
    slugLocked: true,
  } satisfies CreateOrganizationFormType as CreateOrganizationFormType,
});

function OnboardingPage() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();

  const form = useAppForm({
    ...onboardingFormOpts,
    validators: {
      onSubmit: CreateOrganizationFormSchema,
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
        to: "/$orgSlug",
        params: { orgSlug: value.slug },
      });
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
          <form.AppForm>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <form.AppField
                listeners={{
                  onChange: ({ value }) => {
                    if (form.getFieldValue("slugLocked")) {
                      form.setFieldValue("slug", generateSlug(value));
                    }
                  },
                }}
                name="name"
              >
                {(field) => <field.Input label="Organization name" />}
              </form.AppField>

              <form.Subscribe selector={(state) => state.values.slugLocked}>
                {(slugLocked) => (
                  <form.AppField
                    listeners={{
                      onChange: ({ value }) => {
                        const next = normalizeSlugInput(value);
                        if (next !== value) {
                          form.setFieldValue("slug", next);
                        }
                      },
                    }}
                    name="slug"
                  >
                    {(field) => (
                      <field.InputGroup
                        description="Only a-z, 0-9 and hyphens are allowed."
                        label="Slug"
                      >
                        <field.InputGroupInput
                          disabled={slugLocked}
                          placeholder="acme-inc"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            aria-label={
                              slugLocked ? "Unlock slug" : "Lock slug"
                            }
                            onClick={() => {
                              form.setFieldValue("slugLocked", !slugLocked);
                            }}
                            size="icon-xs"
                            title={slugLocked ? "Unlock slug" : "Lock slug"}
                            type="button"
                          >
                            {slugLocked ? <IconLock /> : <IconLockOpen />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </field.InputGroup>
                    )}
                  </form.AppField>
                )}
              </form.Subscribe>

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
          </form.AppForm>
        </CardContent>
      </Card>
    </div>
  );
}
