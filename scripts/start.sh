#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./start.sh [OPTIONS]"
    echo "Start the application containers"
    echo
    echo "Options:"
    echo "  --build    Rebuild containers before starting"
    echo "  --help     Show this help message"
}

# Parse arguments
BUILD=false

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
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Start containers
if [ "$BUILD" = true ]; then
    echo "Starting containers with rebuild..."
    docker-compose up -d --build
else
    echo "Starting containers..."
    docker-compose up -d
fi

echo "Containers started successfully!" 