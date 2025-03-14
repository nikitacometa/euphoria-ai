#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./redeploy.sh [OPTIONS]"
    echo "Redeploy the application"
    echo
    echo "Options:"
    echo "  --no-pull  Skip git pull"
    echo "  --no-build Skip rebuild"
    echo "  --help     Show this help message"
}

# Parse arguments
PULL=true
BUILD=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-pull)
            PULL=false
            shift
            ;;
        --no-build)
            BUILD=false
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Pull latest changes
if [ "$PULL" = true ]; then
    echo "Pulling latest changes..."
    git pull
fi

# Stop containers
echo "Stopping containers..."
docker-compose down

# Start containers
if [ "$BUILD" = true ]; then
    echo "Starting containers with rebuild..."
    docker-compose up -d --build
else
    echo "Starting containers..."
    docker-compose up -d
fi

echo "Redeployment completed successfully!" 