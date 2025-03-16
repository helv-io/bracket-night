# Build frontend
FROM node:14 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build && npm run export

# Build backend
FROM node:14 AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend ./
RUN npm run build

# Final image
FROM node:14
WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend
COPY --from=frontend-build /app/frontend/out ./frontend/out
COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production
ENV NODE_ENV=production
ENV PUBLIC_HOST=https://bracket.my.domain
EXPOSE 3000
CMD ["node", "backend/server.js"]