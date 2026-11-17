FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=platform_env,target=/app/apps/platform/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local --mount=type=cache,target=/root/.bun/install/cache bun install

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN --mount=type=secret,id=platform_env,target=/app/apps/platform/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local cd apps/platform && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3002
EXPOSE 3002

WORKDIR /app/apps/platform
USER bun
CMD ["bun", ".output/server/index.mjs"]
