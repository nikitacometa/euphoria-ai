#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./restart.sh [OPTIONS] [SERVICE]"
    echo "Restart containers"
    echo
    echo "Options:"
    echo "  --build    Rebuild containers before starting"
    echo "  --help     Show this help message"
    echo
    echo "Services:"
    echo "  bot        Restart bot container"
    echo "  mongodb    Restart mongodb container"
    echo "  mongo-express  Restart mongo-express container"
    echo
    echo "If no service is specified, restarts all services"
}

# Parse arguments
BUILD=false
SERVICE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        bot|mongodb|mongo-express)
            SERVICE=$1
            shift
            ;;
        *)
            echo "Unknown option or service: $1"
            show_help
            exit 1
            ;;
    esac
done

# Restart containers
if [ -n "$SERVICE" ]; then
    echo "Stopping $SERVICE..."
    docker-compose stop "$SERVICE"
    
    if [ "$BUILD" = true ] && [ "$SERVICE" = "bot" ]; then
        echo "Rebuilding and starting $SERVICE..."
        docker-compose up -d --build "$SERVICE"
    else
        echo "Starting $SERVICE..."
        docker-compose up -d "$SERVICE"
    fi
else
    echo "Stopping all containers..."
    docker-compose stop
    
    if [ "$BUILD" = true ]; then
        echo "Rebuilding and starting all containers..."
        docker-compose up -d --build
    else
        echo "Starting all containers..."
        docker-compose up -d
    fi
fi

echo "Restart completed successfully!" 