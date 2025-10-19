#!/bin/bash
# Backup script for Docker GUI data

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/docker-gui-backup-${TIMESTAMP}.tar.gz"

echo "Docker GUI Backup Script"
echo "========================"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"

# Backup all volumes
docker run --rm \
  -v docker-gui-data:/data \
  -v nginx-configs:/nginx \
  -v ssl-certificates:/ssl \
  -v powerdns-data:/dns \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine sh -c "
    cd / && \
    tar czf /backup/docker-gui-backup-${TIMESTAMP}.tar.gz \
      data nginx ssl dns
  "

echo "SUCCESS: Backup created: $BACKUP_FILE"
echo ""
echo "To restore this backup, run:"
echo "  ./scripts/restore.sh $BACKUP_FILE"

