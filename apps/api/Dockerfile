FROM node:26-slim AS base
RUN npm install -g pnpm@12.23.0
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.13 prune @argos/api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@argos/api

FROM node:26-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app .
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
