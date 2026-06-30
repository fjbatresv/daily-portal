FROM node:24-slim AS frontend-builder
WORKDIR /workspace
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:24-slim AS backend-builder
WORKDIR /workspace
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY backend backend
RUN npm run build --workspace backend

FROM node:24-slim AS final
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace backend && npm cache clean --force
COPY --from=backend-builder /workspace/backend/dist ./dist
COPY --from=frontend-builder /workspace/backend/dist/public ./dist/public
COPY db ./db
EXPOSE 3000
CMD ["node", "dist/main.js"]
