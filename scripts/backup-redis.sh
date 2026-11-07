#!/bin/bash
# ==============================================================================
# FreightAgent — Redis Automated Backup Script
# Creates a daily snapshot of Redis data and retains the last 7 backups.
# ==============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/freightagent-backend/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REDIS_CONTAINER="${REDIS_CONTAINER:-freightagent-redis}"
REDIS_PASS="${REDIS_PASSWORD:-freightagent_secure_redis_pass}"

mkdir -p "$BACKUP_DIR"

# 1. Trigger Redis background save
echo "[$(date)] Triggering Redis BGSAVE..."
docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASS" bgsave || true

# 2. Short pause for snapshot write to complete
sleep 3

# 3. Copy dump.rdb from container to backup directory
if docker cp "$REDIS_CONTAINER":/data/dump.rdb "$BACKUP_DIR/dump_$TIMESTAMP.rdb" 2>/dev/null; then
    echo "[$(date)] Snapshot copied successfully: $BACKUP_DIR/dump_$TIMESTAMP.rdb"
else
    echo "[$(date)] Warning: dump.rdb copy failed or not found yet."
fi

# 4. Prune snapshots older than 7 days
find "$BACKUP_DIR" -type f -name "dump_*.rdb" -mtime +7 -delete

echo "[$(date)] Backup rotation completed. Active backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"
