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

FROM nginx:1.29-alpine AS nginx-static
COPY --from=frontend-builder /workspace/backend/dist/public /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

FROM node:24-slim AS final
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace backend && npm cache clean --force
COPY --chown=node:node --from=backend-builder /workspace/backend/dist ./dist
COPY --chown=node:node --from=frontend-builder /workspace/backend/dist/public ./dist/public
COPY --chown=node:node db ./db
RUN mkdir -p /app/data && chown -R node:node /app
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
