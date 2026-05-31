FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY dashboard/package.json dashboard/package-lock.json* ./dashboard/
RUN npm ci && npm ci --prefix dashboard
COPY . .
RUN npm run build:all

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3847
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist
EXPOSE 3847
CMD ["node", "dist/index.js"]
