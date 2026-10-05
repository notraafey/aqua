FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY consumer/package*.json ./consumer/

# Install dependencies across workspaces
RUN npm ci

# Copy sources
COPY shared/ ./shared/
COPY consumer/ ./consumer/

# Build packages
RUN npm run build --workspace=shared
RUN npm run build --workspace=consumer

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY consumer/package*.json ./consumer/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/consumer/dist ./consumer/dist

EXPOSE 3002

CMD ["node", "consumer/dist/index.js"]
