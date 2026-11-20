---
name: workholo-orpc-api
description: "Use when adding or changing oRPC procedures, API schemas, router handlers, tenant middleware, or generated API types in packages/api. Covers schema placement and naming, input/output contracts, router hygiene, and generated type ownership."
---

# workholo oRPC API

## Schema files

- Location: `packages/api/src/lib/schemas/<domain>.ts`.
- Group schemas by domain, not one file per schema.
- Current domains: `calls.ts`, `organization.ts`, `platform.ts`, `index.ts`, `shared.ts`.
- Add another file only for a distinct API domain.

## Naming

Format: `<Action><Resource><Direction>Schema`.

| Piece | Example |
|---|---|
| Action | `List`, `Get`, `Create`, `Update`, `Delete`, `Suspend`, `Restore`, `Impersonate` |
| Resource | `Calls`, `Recordings`, `Organizations`, `TeamMembers` |
| Direction | `Input`, `Output` |
| Result | `ListRecordingsInputSchema` |

Rules:

- Every procedure with input declares a named `...InputSchema`.
- Every procedure declares a named `...OutputSchema`.
- Input-less procedures declare output only.
- Shared sub-schemas may omit the action, e.g. `SessionUserSchema`.

## Procedure wiring

```ts
recordings: orgProcedure
  .input(ListRecordingsInputSchema)
  .output(ListRecordingsOutputSchema)
  .handler(async ({ context, input }) => {
    // ...
  }),
```

- No inline `z.object` in `packages/api/src/routers/`.
- Router files import schemas from `../lib/schemas/<domain>`.
- Keep handler return shapes aligned with output schemas.
- Use `.nullable()` for nullable rows and `.nullish()` only when the source type genuinely allows `undefined`, e.g. Better Auth session fields.

## Backend structure

- Procedure builders live only in `packages/api/src/index.ts`.
- Middleware lives in `packages/api/src/utils/middleware.ts`.
- Tenant and organization-input helpers live in `packages/api/src/utils/tenant.ts`.
- Context types live in `packages/api/src/context.ts`.
- Do not create a second procedure-builder file.

## Generated types

- Run `bun scripts/type-generator/index.ts` after schema changes.
- `src/lib/types.ts` is auto-generated. Never edit it by hand.
- The generator scans `src/lib/schemas` and `src/lib/models`.
- Export names ending in `Schema`, `Input`, or `Output` produce types.

## Checklist

- [ ] Schema lives in the correct domain file.
- [ ] Name follows `<Action><Resource><Direction>Schema`.
- [ ] Procedure has `.output()`.
- [ ] Procedure has `.input()` when it accepts input.
- [ ] No inline Zod in router files.
- [ ] Generator run and generated types present.
