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
RUN npm install
COPY backend ./
RUN npm run build

# Final image
FROM node:lts-alpine AS backend
WORKDIR /app/backend
COPY --from=backend-build /app/backend/dist /app/backend
COPY --from=frontend-build /app/frontend/out /app/frontend/out
COPY backend/package*.json /app/backend/
RUN cd /app/backend && npm install --only=production
ENV NODE_ENV=production
ENV PUBLIC_URL=https://bracket.my.domain
EXPOSE 3000
CMD ["node", "server.js"]
