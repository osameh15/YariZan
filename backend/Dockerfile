FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
FROM node:24-alpine
ENV NODE_ENV=development
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/.local && chown node:node /app/.local
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node migrations ./migrations
USER node
CMD ["sh", "-c", "node dist/src/database/migrate.js && node dist/src/database/seed.js && node dist/src/main.js"]
