FROM node:lts-slim AS base

# Create app directory
WORKDIR /app

# Files required by npm install
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci
RUN npm install -g tsx

# Bundle app source
COPY . .

# Type check app
RUN npm run typecheck

FROM base AS runner

# Bundle app source
COPY . .

# Install dependencies and ensure tsx is available
RUN npm ci && npm install -g tsx

USER node

# Start the app
EXPOSE 80
CMD ["tsx", "./src/main.ts"]
