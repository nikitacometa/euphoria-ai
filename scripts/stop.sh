#!/bin/bash

# Script to stop the Docker Compose environment
# Usage: ./stop [-v|--volumes]

VOLUMES=""

# Check if volumes flag is provided
if [[ "$1" == "-v" || "$1" == "--volumes" ]]; then
  VOLUMES="--volumes"
fi

# Stop Docker Compose with or without removing volumes
docker-compose down $VOLUMES
