#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status, or zero if no command exited with a non-zero status.

# === Environment Variables ===
if [ -z "$MONGODB_DATABASE_NAME" ]; then
    echo "!!! ERROR: MONGODB_DATABASE_NAME environment variable is not set. !!!" >&2
    exit 1
fi
DATABASE_TO_BACKUP="$MONGODB_DATABASE_NAME"

# === Dynamic Configuration ===
# Determine container name based on the current directory name
# Assumes script is run from the project's root directory
CURRENT_DIR_NAME=$(basename "$PWD")
if [ -z "$CURRENT_DIR_NAME" ] || [ "$CURRENT_DIR_NAME" = "/" ] || [ "$CURRENT_DIR_NAME" = "." ]; then
    echo "!!! ERROR: Could not determine a valid current directory name ('${CURRENT_DIR_NAME}') for Docker container. Check \$PWD. !!!" >&2
    exit 1
fi
MONGO_CONTAINER_NAME="${CURRENT_DIR_NAME}_mongodb_1"

# === Backup File Configuration ===
FULL_BACKUP_PATH="./mongo_backup.gz" # Backup directly in the current directory ($PWD)

# Backup directory
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd) # Absolute path to the script's directory
BACKUP_ROOT_DIR="${SCRIPT_DIR}/backups"
BACKUP_INSTANCE_DIR="${BACKUP_ROOT_DIR}/${DATABASE_TO_BACKUP}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE_NAME="${DATABASE_TO_BACKUP}_${TIMESTAMP}.gz"
FULL_BACKUP_PATH="${BACKUP_INSTANCE_DIR}/${BACKUP_FILE_NAME}"

# Function to clean up backup file on failure
cleanup_on_error() {
    echo "----------------------------------------------------" >&2
    echo "ERROR: Backup failed." >&2
    echo "Please check Docker logs for '${MONGO_CONTAINER_NAME}' and ensure mongodump is available." >&2
    if [ -f "${FULL_BACKUP_PATH}" ]; then
        echo "Cleaning up partially created backup file: ${FULL_BACKUP_PATH}" >&2
        rm -f "${FULL_BACKUP_PATH}"
    fi
    echo "----------------------------------------------------" >&2
}
trap cleanup_on_error ERR SIGINT SIGTERM

# === Script Logic ===
echo "Starting backup for database: ${DATABASE_TO_BACKUP}..."
# No need to mkdir, backup is in current directory
echo "Backup will be saved to: ${FULL_BACKUP_PATH}"

echo "Running mongodump on container '${MONGO_CONTAINER_NAME}' for database '${DATABASE_TO_BACKUP}'..."
docker exec "${MONGO_CONTAINER_NAME}" mongodump \
    --db "${DATABASE_TO_BACKUP}" \
    --archive \
    --gzip > "${FULL_BACKUP_PATH}"

# If we reach here, the command was successful (due to set -e)
# Disable the trap for normal exit
trap - ERR SIGINT SIGTERM

echo "----------------------------------------------------"
echo "SUCCESS: Backup completed successfully!"
echo "Backup file: ${FULL_BACKUP_PATH}"
echo "Size: $(du -h "${FULL_BACKUP_PATH}" | cut -f1)"
echo "----------------------------------------------------"

exit 0 