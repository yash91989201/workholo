# workholo

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Elysia, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Elysia** - Type-safe, high-performance framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Biome** - Linting and formatting
- **Nx** - Smart monorepo task orchestration and caching
- **Starlight** - Documentation site with Astro
- **Tauri** - Build native desktop applications

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) for the landing site, [http://localhost:3003](http://localhost:3003) for the organization console, [http://localhost:3004](http://localhost:3004) for the agent panel, and [http://localhost:3002](http://localhost:3002) for the platform console. The API listens on [http://localhost:8080](http://localhost:8080); the docs site serves on [http://localhost:3005](http://localhost:3005).
From `apps/native`, run the `ios` script for iOS or the `android` script for Android to build and launch the app. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) for device setup.

## Platform administrators

Platform staff accounts are provisioned out of band; no public endpoint grants the global role. The first `platform_admin` is created with the Better Auth CLI from `apps/server`:

```bash
cd apps/server
bun x auth@latest create-admin \
  --config src/services.ts \
  --email admin@example.com \
  --password 'change-me' \
  --name 'Platform Admin' \
  --role platform_admin
```

The CLI loads `src/services.ts`, so `DATABASE_URL` must point at the target database. The global role is stored on `user.role`; organization invitations and membership changes never modify it. Later role changes go through the audited admin endpoint (`/admin/set-role`).

A globally exported `DATABASE_URL` takes precedence over the app's `.env`; unset it or export the app's value when the CLI or server reports an authentication failure.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@workholo/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Frontend surfaces

Four separately deployed SPAs share one auth backend and the shared clients in `packages/auth-client` and `packages/api-client`:

| App | Audience | Dev port | Gate |
| --- | --- | --- | --- |
| `apps/web` | Public landing site | 3001 | none |
| `apps/console` | Organization owners and administrators | 3003 | session with `owner` or `admin` membership |
| `apps/agent` | Call agents; also hosts the Tauri desktop shell | 3004 | session with `agent` membership |
| `apps/platform` | Platform staff | 3002 | `user.role = platform_admin` |

Surface gates are convenience only; every procedure re-checks the membership and role on the server.

### Environment variables

| App | Variables |
| --- | --- |
| `apps/web` | `VITE_SERVER_URL`, `VITE_CONSOLE_URL` |
| `apps/console` | `VITE_SERVER_URL` |
| `apps/agent` | `VITE_SERVER_URL` |
| `apps/platform` | `VITE_SERVER_URL` |
| `apps/server` | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PORT` (default 8080), `CORS_ORIGIN` (web), `CONSOLE_ORIGIN`, `AGENT_ORIGIN`, `PLATFORM_ORIGIN` |
| `packages/db` | `DATABASE_URL` (imported from `apps/server`) |

The server's four origin variables must match the deployed frontend origins: they feed both `trustedOrigins` for auth and the CORS allow-list. Invitation emails route administrators to `CONSOLE_ORIGIN` and agents to `AGENT_ORIGIN`.

If port 8080 is already in use, change `PORT` and `BETTER_AUTH_URL` in `apps/server/.env` and set the matching `VITE_SERVER_URL` in every frontend's `.env`; the browser will otherwise talk to whatever else owns 8080.

## Deployment

### Docker Compose

- Target: web, console, agent, platform, and server
- Config: `docker-compose.yml` (app Dockerfiles live in `apps/*/Dockerfile`)
- Build images: bun run docker:build
- Start: bun run docker:up
- Logs: bun run docker:logs
- Stop: bun run docker:down

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in `docker-compose.yml` for container networking.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Run checks: `bun run check`

## Project Structure

```
workholo/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   ├── native/      # Mobile application (React Native, Expo)
│   ├── docs/        # Documentation site (Astro Starlight)
│   └── server/      # Backend API (Elysia, ORPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Biome formatting and linting
- `bun run dev:console`: Start the owner/admin console
- `bun run dev:agent`: Start the agent panel
- `bun run dev:platform`: Start the platform console
- `cd apps/agent && bun run desktop:dev`: Start Tauri desktop app in development
- `cd apps/agent && bun run desktop:build`: Build the Tauri desktop app
- `cd apps/docs && bun run dev`: Start documentation site
- `cd apps/docs && bun run build`: Build documentation site
- `bun run docker:build`: Build the Docker Compose images
- `bun run docker:up`: Build and start the Docker Compose stack
- `bun run docker:logs`: Tail logs from the Docker Compose stack
- `bun run docker:down`: Stop the Docker Compose stack

## Better Auth Schema Generation

After changing auth plugins or schema options, run `bun run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.
