FROM node:lts-slim

# Create app directory
WORKDIR /app

# Files required by npm install
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Start the app (will be overridden by docker-compose command for dev mode)
CMD ["npm", "run", "start"]
