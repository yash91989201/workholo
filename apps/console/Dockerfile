FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=console_env,target=/app/apps/console/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local --mount=type=cache,target=/root/.bun/install/cache bun install

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN --mount=type=secret,id=console_env,target=/app/apps/console/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local cd apps/console && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3003
EXPOSE 3003

WORKDIR /app/apps/console
USER bun
CMD ["bun", ".output/server/index.mjs"]
