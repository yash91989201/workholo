FROM node:26-slim AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=agent_env,target=/app/apps/agent/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local --mount=type=cache,target=/root/.bun/install/cache bun install

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN --mount=type=secret,id=agent_env,target=/app/apps/agent/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local cd apps/agent && bun run build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/agent/dist /usr/share/nginx/html
COPY apps/agent/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
