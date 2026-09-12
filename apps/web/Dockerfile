# Build context must be the repo root (this is a pnpm workspace):
#   docker build -f apps/web/Dockerfile .
#
# Runtime approach (temporal, Fase 1): reutiliza el stage de build como
# runtime con `next start` en vez de `output: "standalone"`. Imagen más
# grande (conserva devDependencies y el monorepo completo), pero evita los
# problemas de rutas de outputFileTracingRoot en un monorepo pnpm que no se
# pueden verificar en este entorno sin Docker disponible. Se puede optimizar
# a standalone cuando se revise la topología de deploy completa (Fase 8).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web-legacy/package.json apps/web-legacy/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/notifications/package.json packages/notifications/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @workspace/web run build

FROM build AS runtime
WORKDIR /repo/apps/web
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "run", "start"]
