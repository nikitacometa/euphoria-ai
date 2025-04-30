#!/bin/bash

# Get the container ID of the MongoDB container
APP_NAME=$(basename $(pwd))
CONTAINER_ID="${APP_NAME}_mongodb_1"

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ MongoDB container is not running. Please start it with 'docker-compose up -d mongodb'"
    exit 1
fi

# Source environment variables if .env exists
if [ -f .env ]; then
    source .env
fi

# Set default values if not set in .env
MONGODB_USER=${MONGODB_USER:-admin}
MONGODB_PASSWORD=${MONGODB_PASSWORD:-password}

echo "🔌 Connecting to MongoDB shell..."
docker exec -it $CONTAINER_ID mongosh --port "$MONGODB_PORT" --username "$MONGODB_USER" --password "$MONGODB_PASSWORD" 