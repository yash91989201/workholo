---
name: workholo-forms
description: "Use when implementing or changing frontend forms and user-input write flows. Covers TanStack Form setup, form schema placement and naming, generated form types, UI field usage, submit state, dialog forms, and auth vs oRPC writes."
---

# workholo Forms

## When a form applies

Use a form for structured user input that validates and submits data:

- create, edit, invite, rename, suspend
- nested objects and dynamic arrays
- multi-section input

Do not force a form for:

- search or filter inputs
- immediate select/menu actions
- confirm-only dialogs
- single navigation controls

## Schema files

- Location: `apps/<app>/src/lib/schemas/<domain>.ts`.
- Group schemas by domain, not one file per schema.
- Examples: `auth.ts`, `organization.ts`, `team.ts`, `user.ts`.
- Name: `<Action><Resource>FormSchema`.
- Example: `CreateOrganizationFormSchema`.
- Never define Zod schemas inline in routes or components.

## Generated types

- Import types from `@/lib/types`.
- Generated name: `<Action><Resource>FormType`.
- Example: `CreateOrganizationFormType`.
- Do not hand-edit `src/lib/types.ts`.
- Run `bun scripts/type-generator/index.ts` after schema changes.

## Required setup

```tsx
import { formOptions } from "@tanstack/react-form";
import { useAppForm } from "@workholo/ui/components/form/hooks";

const formOpts = formOptions({
  defaultValues: {
    name: "",
  } satisfies ExampleFormType as ExampleFormType,
});

const form = useAppForm({
  ...formOpts,
  validators: { onSubmit: ExampleFormSchema },
  onSubmit: async ({ value }) => {
    // submit
  },
});
```

## Required JSX shape

```tsx
<form.AppForm>
  <form
    onSubmit={(event) => {
      event.preventDefault();
      form.handleSubmit();
    }}
  >
    <form.AppField name="name">
      {(field) => <field.Input label="Name" />}
    </form.AppField>

    <form.Subscribe
      selector={(state) => ({
        canSubmit: state.canSubmit,
        isSubmitting: state.isSubmitting,
      })}
    >
      {({ canSubmit, isSubmitting }) => (
        <Button disabled={!canSubmit || isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      )}
    </form.Subscribe>
  </form>
</form.AppForm>
```

- Use `field.Input`, `field.Textarea`, `field.Select`, `field.Checkbox`, `field.InputGroup`, `field.InputGroupInput`.
- Field components own labels, descriptions, and validation errors.
- Do not rebuild value/onChange/onBlur wiring manually unless the field component cannot express it.

## Buttons

- Submit: `type="submit"`.
- Cancel, add, remove, toggle: `type="button"`.
- Reset: `type="reset"` or `form.reset()` after success.

## Dialog forms

- Render the form component inside `DialogContent`.
- Let the dialog unmount the form to reset it.
- Keep close behavior in the parent via `onDone`.
- Do not share field state between separate dialogs.

## Auxiliary UI state

UI-only state that must travel with the form can live in the schema:

```ts
export const CreateOrganizationFormSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  slugLocked: z.boolean(),
});
```

Read it with `form.getFieldValue` and write it with `form.setFieldValue`.

## Writes

- oRPC writes: `useMutation(orpc.<domain>.<action>.mutationOptions())`.
- Auth writes: call `authClient` directly.
- Put toasts and query invalidation in mutation callbacks.
- Never call the raw oRPC client from components.

## Checklist

- [ ] Form uses `useAppForm`.
- [ ] Schema lives in the app's domain schema file.
- [ ] Schema name ends with `FormSchema`.
- [ ] Types come from `@/lib/types`.
- [ ] Form is wrapped in `form.AppForm`.
- [ ] Fields use `form.AppField` and UI field components.
- [ ] Submit state comes from `form.Subscribe`.
- [ ] Non-submit buttons use `type="button"`.
