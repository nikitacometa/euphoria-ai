#!/bin/bash

# Script to view Docker Compose logs for the bot container
# Usage: ./log [-f|--follow]

FOLLOW=""

# Check if follow flag is provided
if [[ "$1" == "-f" || "$1" == "--follow" ]]; then
  FOLLOW="--follow"
fi

# TODO: name take from envs
docker-compose logs $FOLLOW mirror-ai_bot_1
