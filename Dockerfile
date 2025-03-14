FROM node:lts-slim AS base

# Create app directory
WORKDIR /app

# Files required by npm install
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Bundle app source
COPY . .

# Type check app
RUN npm run typecheck

FROM base AS runner

# Bundle app source
COPY . .

# For production, we want to use the start script, not dev
# Install all dependencies since we need tsx
RUN npm ci

USER node

# Start the app
EXPOSE 80
CMD ["npm", "run", "start"]
