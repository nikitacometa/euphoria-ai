FROM node:20-slim AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Bundle app source
COPY . .

# Type check app
RUN npm run typecheck

FROM node:20-slim AS runner

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app
COPY --from=builder /app/src ./src

# Use non-root user
USER node

# Start the app
EXPOSE 80
ENV NODE_ENV=production
CMD ["npx", "tsx", "./src/main.ts"]
