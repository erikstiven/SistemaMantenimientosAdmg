# Etapa 1: Construcción (Builder)
FROM node:24-alpine AS builder
WORKDIR /app

# Copiar descriptores de dependencias
COPY package*.json ./
RUN npm ci

# Copiar el código fuente completo
COPY . .

# Compilar frontend (Vite -> dist) y backend (TypeScript -> dist-server)
RUN npm run build

# Etapa 2: Imagen de Producción (Runner optimizado)
FROM node:24-alpine AS runner
WORKDIR /app

# Instalar únicamente dependencias de producción para minimizar tamaño
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar únicamente los artefactos compilados y necesarios
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/sql ./sql

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=6969

EXPOSE 6969

# Comando de arranque del servidor
CMD ["node", "dist-server/server/index.js"]
