import { formOptions } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import { useAppForm } from "@workholo/ui/components/form/hooks";
import { Loader } from "@workholo/ui/components/loader";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { SignUpFormSchema } from "@/lib/schemas/auth";
import type { SignUpFormType } from "@/lib/types";

const signUpFormOpts = formOptions({
  defaultValues: {
    email: "",
    password: "",
    name: "",
  } satisfies SignUpFormType as SignUpFormType,
});

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const navigate = useNavigate();
  const { isPending } = authClient.useSession();

  const form = useAppForm({
    ...signUpFormOpts,
    validators: {
      onSubmit: SignUpFormSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/organizations",
            });
            toast.success("Sign up successful");
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
      <h1 className="mb-6 text-center font-bold text-3xl">Create Account</h1>

      <form.AppForm>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.AppField name="name">
            {(field) => <field.Input label="Name" />}
          </form.AppField>

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
                {isSubmitting ? "Submitting..." : "Sign Up"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </form.AppForm>

      <div className="mt-4 text-center">
        <Button
          className="text-indigo-600 hover:text-indigo-800"
          onClick={onSwitchToSignIn}
          variant="link"
        >
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );
}
