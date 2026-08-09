# Build context must be the repo root (this is a pnpm workspace):
#   docker build -f apps/api/Dockerfile .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @workspace/api run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist

EXPOSE 5000
CMD ["node", "--enable-source-maps", "--env-file-if-exists=.env", "dist/index.mjs"]
