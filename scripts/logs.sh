#!/bin/bash

# Help function
function show_help {
    echo "Usage: ./logs.sh [OPTIONS] [SERVICE]"
    echo "View logs of the application containers"
    echo
    echo "Options:"
    echo "  --follow   Follow log output"
    echo "  --help     Show this help message"
    echo
    echo "Services:"
    echo "  bot        View bot logs"
    echo "  mongodb    View mongodb logs"
    echo "  mongo-express  View mongo-express logs"
    echo
    echo "If no service is specified, shows logs from all services"
}

# Parse arguments
FOLLOW=false
SERVICE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --follow)
            FOLLOW=true
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

# Show logs
if [ "$FOLLOW" = true ]; then
    if [ -n "$SERVICE" ]; then
        echo "Following logs for $SERVICE..."
        docker-compose logs -f "$SERVICE"
    else
        echo "Following all logs..."
        docker-compose logs -f
    fi
else
    if [ -n "$SERVICE" ]; then
        echo "Showing logs for $SERVICE..."
        docker-compose logs "$SERVICE"
    else
        echo "Showing all logs..."
        docker-compose logs
    fi
fi 