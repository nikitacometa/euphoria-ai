#!/bin/bash

# Script to view Docker Compose logs for the bot container
# Usage: ./log [-f|--follow]

FOLLOW=""

# Check if follow flag is provided
if [[ "$1" == "-f" || "$1" == "--follow" ]]; then
  FOLLOW="--follow"
fi

# Get the current directory name as app name
APP_NAME=$(basename $(pwd))

# Use app name in container name pattern
docker logs $FOLLOW "${APP_NAME}_bot_1"
