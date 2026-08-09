# Build context must be the repo root (this is a pnpm workspace):
#   docker build -f apps/web/Dockerfile --build-arg BASE_PATH=/ \
#     --build-arg VITE_GOOGLE_MAPS_API_KEY=... .

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
# BASE_PATH is baked into the built assets' URLs (Vite `base`), so it must match
# the path this app is served from. PORT is only required by vite.config.ts to
# not throw during the build — it has no effect on the static output.
# VITE_GOOGLE_MAPS_API_KEY is baked into the client bundle here too — this is
# a static site, there is no runtime process to inject env vars into later.
ARG BASE_PATH=/
ARG VITE_GOOGLE_MAPS_API_KEY
ENV BASE_PATH=$BASE_PATH
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV PORT=3000
RUN pnpm --filter @workspace/web run build

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist/public /usr/share/nginx/html

EXPOSE 80
