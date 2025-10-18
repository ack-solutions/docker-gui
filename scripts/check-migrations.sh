#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Checking Database Migrations Status..."
echo ""

# Check if database exists
if [ ! -f "db/docker-gui.db" ]; then
    echo -e "${RED}❌ Database not found at db/docker-gui.db${NC}"
    exit 1
fi

# Check migrations table
echo "📋 Migration History:"
sqlite3 db/docker-gui.db << 'EOF'
.mode column
.headers on
SELECT 
    id,
    datetime(timestamp/1000, 'unixepoch') as run_date,
    name
FROM migrations 
ORDER BY timestamp;
EOF

echo ""
echo "📊 Database Tables:"
sqlite3 db/docker-gui.db << 'EOF'
.mode line
SELECT 
    name as table_name,
    COUNT(*) as row_count
FROM sqlite_master 
WHERE type='table' AND name NOT LIKE 'sqlite_%'
GROUP BY name
ORDER BY name;
EOF

echo ""
echo -e "${GREEN}✅ Migration check complete!${NC}"
echo ""
echo "Available commands:"
echo "  yarn db:migrate          - Run pending migrations"
echo "  yarn db:migrate:revert   - Revert last migration"
echo "  yarn migration:generate  - Generate new migration"

