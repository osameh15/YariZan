# YariZan API (NestJS). Build context: backend/.
# Runtime command starts only the API. Migrations are a separate one-off command:
#   docker run --rm --read-only <image> node dist/src/database/migrate.js
# No seed, migration or key generation runs at startup. The image selects no NODE_ENV.
# Base image: node 24.22.0 Alpine, pinned by multi-arch index digest (reviewed 2026-10-16).
ARG NODE_IMAGE=node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund \
  && find dist -name '*.map' -delete && rm -rf dist/test

FROM ${NODE_IMAGE} AS runtime
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="yarizan-api" \
  org.opencontainers.image.source="https://github.com/osameh15/YariZan" \
  org.opencontainers.image.revision="${SOURCE_COMMIT}"
# Runtime needs only node: remove package managers so no install tooling ships in the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
# Root-owned, read-only application files. Nothing under /app is writable by uid 1000.
COPY --from=build --chown=0:0 /app/package.json ./package.json
COPY --from=build --chown=0:0 /app/node_modules ./node_modules
COPY --from=build --chown=0:0 /app/dist ./dist
COPY --chown=0:0 migrations ./migrations
USER 1000:1000
EXPOSE 3100
STOPSIGNAL SIGTERM
CMD ["node", "dist/src/main.js"]

# Local development only (backend/compose.yaml): adds a writable /app/.local for disposable
# development signing keys and the fake SMS spool. Never published or deployed.
FROM runtime AS development
USER 0:0
RUN mkdir /app/.local && chown 1000:1000 /app/.local
USER 1000:1000

# Default target: the production runtime image, identical to "runtime".
FROM runtime AS production
