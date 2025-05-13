#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status, or zero if no command exited with a non-zero status.

# === Dynamic Configuration ===
# Determine container name based on the current directory name
# Assumes script is run from the project's root directory
CURRENT_DIR_NAME=$(basename "$PWD")
if [ -z "$CURRENT_DIR_NAME" ] || [ "$CURRENT_DIR_NAME" = "/" ] || [ "$CURRENT_DIR_NAME" = "." ]; then
    echo "!!! ERROR: Could not determine a valid current directory name ('${CURRENT_DIR_NAME}') for Docker container. Check \$PWD. !!!" >&2
    exit 1
fi
MONGO_CONTAINER_NAME="${CURRENT_DIR_NAME}_mongodb_1"

# === Script Arguments & Defaults ===
# Environment variable MONGODB_DATABASE_NAME is used for default database names.
# Backup file path defaults to ./mongo_backup.gz in the current directory.

DEFAULT_NEW_DB_NAME="${MONGODB_DATABASE_NAME}"
DEFAULT_BACKUP_FILE_PATH="./mongo_backup.gz"
DEFAULT_ORIGINAL_DB_NAME="${MONGODB_DATABASE_NAME}"

NEW_DATABASE_NAME="${1:-${DEFAULT_NEW_DB_NAME}}"
BACKUP_FILE_PATH="${2:-${DEFAULT_BACKUP_FILE_PATH}}"
ORIGINAL_DB_NAME_IN_BACKUP="${3:-${DEFAULT_ORIGINAL_DB_NAME}}"

# Validate that database names are set, either via argument or MONGODB_DATABASE_NAME
if [ -z "$NEW_DATABASE_NAME" ]; then
    echo "!!! ERROR: New database name is not specified and MONGODB_DATABASE_NAME is not set. !!!" >&2
    echo "Usage: $0 [new_db_name] [backup_file_path] [original_db_name]" >&2
    echo "Please provide <new_database_name> or set MONGODB_DATABASE_NAME." >&2
    exit 1
fi
if [ -z "$ORIGINAL_DB_NAME_IN_BACKUP" ]; then
    echo "!!! ERROR: Original database name in backup is not specified and MONGODB_DATABASE_NAME is not set. !!!" >&2
    echo "Usage: $0 [new_db_name] [backup_file_path] [original_db_name]" >&2
    echo "Please provide <original_database_name_in_backup> or set MONGODB_DATABASE_NAME." >&2
    exit 1
fi

# Function to handle errors
handle_error() {
    echo "----------------------------------------------------" >&2
    echo "ERROR: Restore failed." >&2
    echo "Please check Docker logs for '${MONGO_CONTAINER_NAME}' and ensure the backup file is valid." >&2
    echo "Also, verify that the original database name ('${ORIGINAL_DB_NAME_IN_BACKUP}') matches the content of the backup." >&2
    echo "----------------------------------------------------" >&2
}
trap handle_error ERR SIGINT SIGTERM

# === Script Logic ===
if [ "$MONGO_CONTAINER_NAME" = "your_mongodb_container_name" ]; then
    echo "ERROR: Please update the MONGO_CONTAINER_NAME placeholder in this script." >&2
    exit 1
fi

echo "Starting restore process..."
echo "  New Database Name: ${NEW_DATABASE_NAME}"
echo "  Backup File: ${BACKUP_FILE_PATH}"
echo "  Original DB in Backup: ${ORIGINAL_DB_NAME_IN_BACKUP}"
echo "  Target Container: ${MONGO_CONTAINER_NAME}"

if [ ! -f "${BACKUP_FILE_PATH}" ]; then
    echo "ERROR: Backup file not found at '${BACKUP_FILE_PATH}'" >&2
    exit 1
fi

echo "Running mongorestore on container '${MONGO_CONTAINER_NAME}'..."
echo "This will restore '${ORIGINAL_DB_NAME_IN_BACKUP}' from the backup to a NEW database named '${NEW_DATABASE_NAME}'."

cat "${BACKUP_FILE_PATH}" | docker exec -i "${MONGO_CONTAINER_NAME}" mongorestore \
    --archive \
    --gzip \
    --nsFrom "${ORIGINAL_DB_NAME_IN_BACKUP}.*" \
    --nsTo "${NEW_DATABASE_NAME}.*"

# If we reach here, the command was successful
trap - ERR SIGINT SIGTERM # Disable trap for normal exit

echo "----------------------------------------------------"
echo "SUCCESS: Restore completed successfully!"
echo "Database '${ORIGINAL_DB_NAME_IN_BACKUP}' from backup has been restored as '${NEW_DATABASE_NAME}'."
echo "----------------------------------------------------"

exit 0 