# syntax=docker/dockerfile:1

# Frontend static export is arch-independent. Build it on the native builder
# platform so npm/esbuild never run under QEMU (avoids ETXTBSY / SIGILL flakes
# on linux/arm64 Buildx). Pin Node 20 to match .nvmrc (not floating node:lts).
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-build

# better-sqlite3 may be pulled via backend imports used by next.config.ts
RUN apk add --no-cache python3 make g++

# Serialize npm under constrained builders
ENV npm_config_maxsockets=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false

# Root package.json supplies NEXT_PUBLIC_APP_VERSION (read by next.config.ts).
# Strip workspaces so nested package installs are not treated as a monorepo.
COPY package.json /app/package.json
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/app/package.json','utf8')); delete p.workspaces; delete p.scripts; fs.writeFileSync('/app/package.json', JSON.stringify(p, null, 2));"

WORKDIR /app/backend
COPY backend/package*.json ./
RUN set -eu; \
  for i in 1 2 3; do \
    npm install && exit 0; \
    echo "npm install failed (attempt $i/3), retrying..."; \
    rm -rf node_modules; \
    sleep $((i * 5)); \
  done; \
  exit 1
COPY backend ./

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN set -eu; \
  for i in 1 2 3; do \
    npm install && exit 0; \
    echo "npm install failed (attempt $i/3), retrying..."; \
    rm -rf node_modules; \
    sleep $((i * 5)); \
  done; \
  exit 1
COPY frontend ./
ENV NODE_ENV=production
RUN npm run build

# Backend must be built per-target (better-sqlite3 native module).
FROM node:20-alpine AS backend-build
RUN apk add --no-cache python3 make g++
ENV npm_config_maxsockets=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false
WORKDIR /app/backend
COPY backend/package*.json ./
# Retry: esbuild postinstall can still flake under qemu/arm64
RUN set -eu; \
  for i in 1 2 3; do \
    npm install && exit 0; \
    echo "npm install failed (attempt $i/3), retrying..."; \
    rm -rf node_modules; \
    sleep $((i * 5)); \
  done; \
  exit 1
COPY backend ./
RUN npm run build \
  && npm prune --omit=dev

# Final image
FROM node:20-alpine AS backend
WORKDIR /app/backend
RUN apk add --no-cache libstdc++
COPY --from=backend-build /app/backend/dist /app/backend
COPY --from=backend-build /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-build /app/backend/package.json /app/backend/package.json
COPY --from=frontend-build /app/frontend/out /app/frontend/out
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
