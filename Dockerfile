# Build frontend
FROM node:22 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
COPY backend/ ../backend
RUN npm run build

# Build backend
FROM node:22 AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend ./
RUN npm run build

# Final image
FROM node:22 AS backend
WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend
COPY --from=frontend-build /app/frontend/out ./frontend/out
COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production
ENV NODE_ENV=production
ENV PUBLIC_URL=https://bracket.my.domain
EXPOSE 3000
CMD ["node", "backend/server.js"]
