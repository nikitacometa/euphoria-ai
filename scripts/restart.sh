#!/bin/bash

# Script to pull latest changes and redeploy the Docker environment
# Usage: ./redeploy [-v|--volumes] [-b|--build]

# Parse arguments
VOLUMES=""
BUILD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--volumes)
      VOLUMES="-v"
      shift
      ;;
    -b|--build)
      BUILD="-b"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./restart.sh [-v|--volumes] [-b|--build]"
      exit 1
      ;;
  esac
done

# Stop the current Docker environment
echo "Stopping Docker environment..."
./scripts/stop.sh $VOLUMES

# Start Docker environment again
echo "Starting Docker environment..."
./scripts/start.sh $BUILD

echo "Restart completed." 