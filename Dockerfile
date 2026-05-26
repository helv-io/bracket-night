# Build frontend
FROM node:lts-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
COPY backend/ ../backend
RUN npm run build

# Build backend
FROM node:lts-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN apk add --no-cache python3 make g++ \
 && npm install \
 && apk del python3 make g++
COPY backend ./
RUN npm run build

# Final image
FROM node:lts-alpine AS backend
WORKDIR /app/backend
COPY --from=backend-build /app/backend/dist /app/backend
COPY --from=frontend-build /app/frontend/out /app/frontend/out
COPY backend/package*.json /app/backend/
RUN apk add --no-cache python3 make g++ \
 && cd /app/backend && npm install --omit=dev \
 && apk del python3 make g++
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
