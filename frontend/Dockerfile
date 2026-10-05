FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY consumer/package*.json ./consumer/

RUN npm ci

COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN npm run build --workspace=shared
RUN npm run build --workspace=frontend

FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
