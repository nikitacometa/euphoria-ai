#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./stop.sh [OPTIONS]"
    echo "Stop the application containers"
    echo
    echo "Options:"
    echo "  --clean    Remove containers and volumes"
    echo "  --help     Show this help message"
}

# Parse arguments
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
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

# Stop containers
if [ "$CLEAN" = true ]; then
    echo "Stopping and removing containers and volumes..."
    docker-compose down -v
else
    echo "Stopping containers..."
    docker-compose down
fi

echo "Containers stopped successfully!" 