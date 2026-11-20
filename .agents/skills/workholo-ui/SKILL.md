---
name: workholo-ui
description: "Use when adding, moving, or consuming UI components, shared design-system primitives, or icons. Covers the @workholo/ui package boundary, generic vs app-specific components, Tabler-only icon usage, and dependency ownership."
---

# workholo UI

## Package boundary

- Shared design system: `packages/ui/src/components`.
- Import shared components from `@workholo/ui/components/<name>`.
- Use shadcn primitives from `packages/ui` instead of rebuilding them.
- App-local components are only for app-specific business or navigation UI.

## Generic components belong in UI

Move a component to `packages/ui` when it is generic, reusable, or duplicated across apps.

Current shared set:

- `DataTable`
- `Loader`
- `ModeToggle`
- `ThemeProvider`

App-local examples that stay:

- `header.tsx`
- `user-menu.tsx`
- `org-header.tsx`
- sidebar components
- sign-in and sign-up forms
- React Native components

## Adding a shared component

1. Create `packages/ui/src/components/<name>.tsx`.
2. Export a named component.
3. Import with `@workholo/ui/components/<name>`.
4. Add required packages to `packages/ui/package.json`.
5. Use the root catalog when a catalog entry exists.

## Moving a component

1. Copy the implementation into `packages/ui/src/components`.
2. Update every app import.
3. Delete the local copies.
4. Remove app dependencies that become unused.
5. Run `bun install`.
6. Confirm no local imports remain.

## Icons

- Icon library: Tabler only.
- Package: `@tabler/icons-react`.
- Never import `lucide-react`.
- Never add lucide packages.
- Icon component names use `Icon*`, e.g. `IconDots`, `IconUsers`, `IconChevronRight`.
- Icon type: `type TablerIcon` from `@tabler/icons-react`.
- Apps that import icons directly must declare `@tabler/icons-react` in their own `package.json`.
- `packages/ui/components.json` sets `"iconLibrary": "tabler"`.

Common mappings:

| Lucide | Tabler |
|---|---|
| `DotsHorizontal` / `MoreHorizontal` | `IconDots` |
| `Users` | `IconUsers` |
| `UsersRound` | `IconUsersGroup` |
| `Building2` | `IconBuilding` |
| `ChevronRight` | `IconChevronRight` |
| `ChevronsUpDown` | `IconSelector` |
| `ArrowLeft` | `IconArrowLeft` |
| `LogOut` | `IconLogout` |
| `Lock` | `IconLock` |
| `LockOpen` | `IconLockOpen` |
| `Loader2` | `IconLoader2` |
| `Monitor` | `IconDeviceDesktop` |
| `Moon` | `IconMoon` |
| `Sun` | `IconSun` |

## Checklist

- [ ] Component is generic, not app-specific.
- [ ] Shared component lives in `packages/ui`.
- [ ] Import uses `@workholo/ui/components/<name>`.
- [ ] No local duplicate remains.
- [ ] UI package dependencies updated.
- [ ] Unused app dependencies removed.
- [ ] Icons use Tabler only.
