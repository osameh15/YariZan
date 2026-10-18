# YariZan web (Nuxt 4 SSR). Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg YARIZAN_BUILD_PROFILE=storefront -t yarizan-web .
# Profiles: brochure (maintenance/rollback), storefront (public site with approved prices), full.
# The profile is baked in; at runtime YARIZAN_SITE_MODE must equal it or the server refuses to start.
# Base image: node 24.22.0 Alpine, pinned by multi-arch index digest (reviewed 2026-10-16).
ARG NODE_IMAGE=node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

FROM ${NODE_IMAGE} AS build
ARG YARIZAN_BUILD_PROFILE
RUN test "$YARIZAN_BUILD_PROFILE" = brochure || test "$YARIZAN_BUILD_PROFILE" = storefront \
  || test "$YARIZAN_BUILD_PROFILE" = full \
  || (echo 'YARIZAN_BUILD_PROFILE must be brochure, storefront or full' >&2; exit 1)
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/web ./
ENV YARIZAN_BUILD_PROFILE=${YARIZAN_BUILD_PROFILE} YARIZAN_OUTPUT_DIR=.output NUXT_TELEMETRY_DISABLED=1
RUN npm run build && find .output -name '*.map' -delete

FROM ${NODE_IMAGE} AS runtime
ARG YARIZAN_BUILD_PROFILE
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="yarizan-web" \
  org.opencontainers.image.source="https://github.com/osameh15/YariZan" \
  org.opencontainers.image.revision="${SOURCE_COMMIT}" \
  games.oarnova.yarizan.build-profile="${YARIZAN_BUILD_PROFILE}"
# Runtime needs only node: remove package managers so no install tooling ships in the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
# Root-owned, read-only application files; the process runs as uid/gid 1000 and writes nothing.
COPY --from=build --chown=0:0 /app/.output ./.output
# Nitro graceful shutdown must finish inside the infrastructure's 20 s stop grace period.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3200 NITRO_SHUTDOWN_TIMEOUT=15000
USER 1000:1000
EXPOSE 3200
STOPSIGNAL SIGTERM
CMD ["node", ".output/server/index.mjs"]
