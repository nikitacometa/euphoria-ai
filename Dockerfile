FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run typecheck && npm run build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]
