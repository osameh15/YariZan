FROM node:24-alpine AS build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci --ignore-scripts
COPY apps/web ./
RUN npm run build
FROM node:24-alpine
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
CMD ["node", ".output/server/index.mjs"]
