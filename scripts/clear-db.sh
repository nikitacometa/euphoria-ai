#!/bin/bash

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored text
print_color() {
    color=$1
    text=$2
    echo -e "${color}${text}${NC}"
}

# Function to confirm action
confirm() {
    read -p "$(print_color $YELLOW "⚠️  $1 [y/N]: ")" choice
    case "$choice" in 
        y|Y ) return 0;;
        * ) return 1;;
    esac
}

# Function to drop a specific database
drop_database() {
    db_name=$1
    print_color $YELLOW "Dropping database: $db_name..."
    mongosh --eval "db.getSiblingDB('$db_name').dropDatabase()" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_color $GREEN "✅ Successfully dropped $db_name database"
    else
        print_color $RED "❌ Failed to drop $db_name database"
    fi
}

# Main script
echo "🗑️  MongoDB Database Cleanup Script"
echo "--------------------------------"

# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    print_color $RED "❌ MongoDB is not running. Please start MongoDB first."
    exit 1
fi

# List all databases
echo "Current databases:"
echo "----------------"
mongosh --eval "db.adminCommand('listDatabases')" | grep "name:" | sed 's/.*name: '\''//;s/'\''.*//' | nl

# Confirm before proceeding
if ! confirm "Do you want to proceed with database cleanup?"; then
    print_color $YELLOW "Operation cancelled"
    exit 0
fi

# Ask which databases to drop
echo
echo "Select databases to drop:"
echo "1) Only euphoria database"
echo "2) All bot-related databases"
echo "3) Custom selection"
read -p "Enter your choice (1-3): " db_choice

case $db_choice in
    1)
        if confirm "Are you sure you want to drop the euphoria database?"; then
            drop_database "euphoria"
        fi
        ;;
    2)
        if confirm "Are you sure you want to drop all bot-related databases?"; then
            bot_dbs=("euphoria" "euphoria_test" "EuphoriaAI" "EuphoriaPro")
            for db in "${bot_dbs[@]}"; do
                drop_database "$db"
            done
        fi
        ;;
    3)
        echo "Enter database names to drop (space-separated):"
        read -p "> " custom_dbs
        if [ -n "$custom_dbs" ] && confirm "Are you sure you want to drop the specified databases?"; then
            for db in $custom_dbs; do
                drop_database "$db"
            done
        fi
        ;;
    *)
        print_color $RED "Invalid choice"
        exit 1
        ;;
esac

print_color $GREEN "🎉 Database cleanup completed!" 
