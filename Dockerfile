# Pin Node 20 LTS (matches .nvmrc). Floating node:lts can jump to Node 24 and
# worsen Buildx/QEMU arm64 flakes (esbuild postinstall ETXTBSY).
FROM node:20-alpine AS frontend-build

# better-sqlite3 (pulled for frontend typecheck/config imports) needs a toolchain
RUN apk add --no-cache python3 make g++

# Serialize npm network + retries under QEMU to avoid parallel unpack/exec races
ENV npm_config_maxsockets=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false

# Root package.json supplies NEXT_PUBLIC_APP_VERSION (read by next.config.ts)
COPY package.json /app/package.json

WORKDIR /app/backend
COPY backend/package*.json ./
# Retry npm install: esbuild's postinstall can hit ETXTBSY under qemu/arm64
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
# Ensure the arch-native esbuild binary is present after a flaky postinstall
RUN npm install --no-save "@esbuild/linux-$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/')" \
  || npm rebuild esbuild \
  || true
COPY frontend ./
ENV NODE_ENV=production
RUN npm run build

# Build backend (better-sqlite3 needs native toolchain)
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
