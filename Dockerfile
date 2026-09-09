# syntax=docker/dockerfile:1

# Frontend is arch-independent. Build it on the native builder platform
# so npm never runs under QEMU. Pin Node 20 to match .nvmrc.
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-build

ENV npm_config_maxsockets=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false

WORKDIR /app/frontend
COPY frontend/package.json ./
COPY frontend/package-lock.json* ./
RUN set -eu; \
  for i in 1 2 3; do \
    npm install && exit 0; \
    echo "npm install failed (attempt $i/3), retrying..."; \
    rm -rf node_modules; \
    sleep $((i * 5)); \
  done; \
  exit 1
COPY frontend ./
COPY engine /app/engine
COPY package.json /tmp/root-package.json
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/tmp/root-package.json','utf8')); fs.writeFileSync('/app/package.json', JSON.stringify({ name: p.name, version: p.version }, null, 2));"
ENV NODE_ENV=production
RUN npm run build

# Backend is built per-target (better-sqlite3 native module). Engine is bundled in.
FROM node:20-alpine AS backend-build
RUN apk add --no-cache python3 make g++
ENV npm_config_maxsockets=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false
WORKDIR /app/backend
COPY backend/package.json ./
COPY backend/package-lock.json* ./
RUN set -eu; \
  for i in 1 2 3; do \
    npm install && exit 0; \
    echo "npm install failed (attempt $i/3), retrying..."; \
    rm -rf node_modules; \
    sleep $((i * 5)); \
  done; \
  exit 1
COPY backend ./
COPY engine /app/engine
RUN npm run build \
  && npm prune --omit=dev

FROM node:20-alpine AS backend
WORKDIR /app/backend
RUN apk add --no-cache libstdc++
COPY --from=backend-build /app/backend/dist /app/backend
COPY --from=backend-build /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-build /app/backend/package.json /app/backend/package.json
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
