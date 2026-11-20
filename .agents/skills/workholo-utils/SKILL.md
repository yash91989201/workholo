---
name: workholo-utils
description: "Use when adding reusable helpers or moving inline logic into utility files. Covers frontend and backend utility placement, logical grouping, naming, and tests for non-trivial pure helpers."
---

# workholo Utils

## Placement

| Scope | Location |
|---|---|
| Frontend app | `apps/<app>/src/utils/<concern>.ts` |
| Backend API | `packages/api/src/utils/<concern>.ts` |
| Shared UI | `packages/ui/src/lib/<concern>.ts` |

Group related helpers in one file named by concern:

- `slug.ts`
- `tenant.ts`
- `middleware.ts`
- `orpc.ts`

Do not create one file per function.

## Rules

- Reusable logic belongs in a utils file, not inline in a route or component.
- Keep functions focused and named by behavior.
- Keep browser-only and server-only helpers in their own workspaces.
- Do not put React components in utils files.
- Do not put generated types in utils.
- Pure helpers with non-trivial rules need a focused test next to the file.

## Example

```ts
// apps/console/src/utils/slug.ts
export function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

```ts
// apps/console/src/utils/slug.test.ts
import { describe, expect, test } from "bun:test";

import { generateSlug } from "./slug";

describe("generateSlug", () => {
  test("joins words with single hyphens", () => {
    expect(generateSlug("Acme Inc")).toBe("acme-inc");
  });
});
```

## Backend utilities

- Middleware: `packages/api/src/utils/middleware.ts`.
- Tenant helpers: `packages/api/src/utils/tenant.ts`.
- oRPC context builder: `packages/api/src/utils/orpc.ts`.
- Procedure builders stay in `packages/api/src/index.ts`, not utils.

## Checklist

- [ ] Helper is reusable.
- [ ] File is named by concern.
- [ ] Related helpers are grouped together.
- [ ] No inline duplicate remains at the call site.
- [ ] Non-trivial pure helper has a test.
