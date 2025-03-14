#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./db.sh [OPTIONS]"
    echo "Access MongoDB shell"
    echo
    echo "Options:"
    echo "  --express  Open Mongo Express in default browser"
    echo "  --help     Show this help message"
}

# Parse arguments
EXPRESS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --express)
            EXPRESS=true
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

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

MONGODB_USER=${MONGODB_USER:-admin}
MONGODB_PASSWORD=${MONGODB_PASSWORD:-password}
MONGODB_PORT=${MONGODB_PORT:-27017}
MONGO_EXPRESS_PORT=${MONGO_EXPRESS_PORT:-8081}

if [ "$EXPRESS" = true ]; then
    echo "Opening Mongo Express in browser..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:${MONGO_EXPRESS_PORT}"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "http://localhost:${MONGO_EXPRESS_PORT}"
    else
        echo "Please open http://localhost:${MONGO_EXPRESS_PORT} in your browser"
    fi
else
    echo "Connecting to MongoDB shell..."
    docker-compose exec mongodb mongosh \
        --username "$MONGODB_USER" \
        --password "$MONGODB_PASSWORD" \
        --authenticationDatabase admin
fi 