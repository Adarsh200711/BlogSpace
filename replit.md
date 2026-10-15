# BlogSpace

An open writing community where people publish ideas, read other perspectives, and discuss articles through comments.

## Run & Operate

- `pnpm run typecheck` — typecheck libraries and all workspace packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI contract
- `pnpm --filter @workspace/db run push` — apply development PostgreSQL schema changes
- Required env: `DATABASE_URL`; Clerk keys are provisioned through Replit-managed auth

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/blogspace/` — responsive web application and Clerk pages
- `artifacts/api-server/src/routes/blogspace.ts` — BlogSpace REST endpoints
- `lib/api-spec/openapi.yaml` — API contract and generated client source
- `lib/db/src/schema/` — user, post, and comment tables

## Architecture decisions

- Clerk owns sign-up, sign-in, browser sessions, and logout; PostgreSQL stores only the app profile mirror and writing data.
- Every account's app profile is keyed by its Clerk user ID so posts and comments can enforce ownership with foreign keys.
- Posts publish immediately; there is no draft or moderation state in this version.

## Product

- Read published posts and comments without an account.
- Register and sign in, publish posts, edit or delete only your own posts, and comment while signed in.
- Manage posts and view writing and engagement totals on the writer dashboard.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Define API changes in `lib/api-spec/openapi.yaml` and rerun codegen before using new client or server schemas.
- Browser API calls use Clerk's same-origin session cookie; do not add bearer-token handling or a custom API logout flow.
- Apply database changes to development with `pnpm --filter @workspace/db run push`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
