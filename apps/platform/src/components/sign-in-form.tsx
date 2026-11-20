import { formOptions } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { Loader } from "@workholo/ui/components/loader";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { SignInFormSchema } from "@/lib/schemas/auth";
import type { SignInFormType } from "@/lib/types";

const signInFormOpts = formOptions({
  defaultValues: {
    email: "",
    password: "",
  } satisfies SignInFormType as SignInFormType,
});

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate();
  const { isPending } = authClient.useSession();

  const form = useAppForm({
    ...signInFormOpts,
    validators: {
      onSubmit: SignInFormSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/organizations",
            });
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

      <form.AppForm>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="email">
            {(field) => <field.Input label="Email" type="email" />}
          </form.AppField>

          <form.AppField name="password">
            {(field) => <field.Input label="Password" type="password" />}
          </form.AppField>

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
                {isSubmitting ? "Submitting..." : "Sign In"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </form.AppForm>

      <div className="mt-4 text-center">
        <Button
          className="text-indigo-600 hover:text-indigo-800"
          onClick={onSwitchToSignUp}
          variant="link"
        >
          Need an account? Sign Up
        </Button>
      </div>
    </div>
  );
}
