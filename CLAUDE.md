# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/web run dev` — run the frontend (Vite)
- `pnpm --filter @workspace/api run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run deploy:migrate` — frozen install + DB schema push (run on deploy)
- Required env: `DATABASE_URL` — Postgres connection string, `PORT`, `BASE_PATH` (frontend)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `apps/web` — frontend (Vite + React)
- `apps/api` — backend (Express)
- `lib/db`, `lib/api-zod`, `lib/api-client-react`, `lib/api-spec` — shared packages used by both apps
- `attached_assets/` — reference material (logos, prompts, design system docs); not wired into the build

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `apps/web/vite.config.ts` and `apps/api` both require `PORT` at runtime (and `apps/web` also requires `BASE_PATH`) — they throw if missing. Local dev reads them from each app's `.env` (gitignored); production (EasyPanel) sets them as real container env vars, no `.env` file needed (`--env-file-if-exists` / Vite's `loadEnv` both no-op if the file is absent).
- `BASE_PATH` is baked into the built frontend assets' URLs at build time (Vite `base`) — it must match the path the app is actually served from in prod (`/` unless served under a subpath).
- Dev and production currently point at the **same** Postgres instance (EasyPanel-managed, on the VPS) — there is no separate local/dev database. Be careful running destructive Drizzle commands (`push --force`) locally.
- `lib/db`, `lib/api-zod`, `lib/api-client-react` export raw `.ts` source (no build step) — consumed directly by Vite/esbuild via workspace linking.

## Deploy (EasyPanel)

- Two services, each built from this repo with **build context = repo root**, not the app subfolder:
  - `apps/api/Dockerfile` → backend. Env vars: `DATABASE_URL`, `PORT` (5000), `NODE_ENV=production`.
  - `apps/web/Dockerfile` → frontend, built to static files and served by nginx. Build arg `BASE_PATH` (defaults to `/`).
- Postgres: managed by EasyPanel (separate service in the same project).
- No CI/tests configured yet — verify with `pnpm run typecheck` before deploying.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- No mockup-sandbox / scripts packages — removed as non-essential to the deployable app
