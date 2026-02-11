#!/bin/bash

# Database Migration Script
# Adds the full_name column to the users table if it doesn't exist

DB_PATH="/root/bitnova-bot/bitnova.db"

echo "🔧 Checking database schema..."

# Check if full_name column exists
COLUMN_EXISTS=$(echo "PRAGMA table_info(users);" | sqlite3 "$DB_PATH" | grep "full_name" || echo "")

if [ -z "$COLUMN_EXISTS" ]; then
    echo "📝 Adding full_name column to users table..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN full_name TEXT;"
    echo "✅ Migration complete!"
else
    echo "✅ Column already exists, no migration needed."
fi
