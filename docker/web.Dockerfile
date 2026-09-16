# Builds one frontend workspace and serves the static output with nginx.
# Pick the app with --build-arg APP=admin|mobile; the context is the repository root.
ARG APP

FROM node:22-alpine AS build
ARG APP
WORKDIR /repo
RUN corepack enable

# The lockfile and every manifest first, so an install layer survives source-only changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/api-client/package.json packages/api-client/
COPY packages/fixtures/package.json packages/fixtures/
COPY packages/integration/package.json packages/integration/
COPY packages/tailwind-config/package.json packages/tailwind-config/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/${APP}/ apps/${APP}/
RUN pnpm --filter @monitoring/${APP} build && mv apps/${APP}/dist /dist

FROM nginx:1.27-alpine AS runtime
ARG APP
COPY --from=build /dist /usr/share/nginx/html
COPY apps/${APP}/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/env-url.sh /docker-entrypoint.d/99-api-url.sh
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/env.js >/dev/null || exit 1
