# Build frontend (imports backend types + config)
FROM node:lts-alpine AS frontend-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend ./
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
ENV NODE_ENV=production
RUN npm run build

# Build backend (better-sqlite3 needs native toolchain)
FROM node:lts-alpine AS backend-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend ./
RUN npm run build \
  && npm prune --omit=dev

# Final image
FROM node:lts-alpine AS backend
WORKDIR /app/backend
RUN apk add --no-cache libstdc++
COPY --from=backend-build /app/backend/dist /app/backend
COPY --from=backend-build /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-build /app/backend/package.json /app/backend/package.json
COPY --from=frontend-build /app/frontend/out /app/frontend/out
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
