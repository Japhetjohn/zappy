#!/bin/bash

# Comprehensive Database Migration Script
# Ensures all columns exist in the users table

DB_PATH="/root/bitnova-bot/bitnova.db"

echo "🔧 Running comprehensive database migration..."

# Function to check if column exists
column_exists() {
    local column_name=$1
    echo "PRAGMA table_info(users);" | sqlite3 "$DB_PATH" | grep -q "$column_name"
    return $?
}

# Add full_name if missing
if ! column_exists "full_name"; then
    echo "📝 Adding full_name column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN full_name TEXT;"
fi

# Add last_seen if missing  
if ! column_exists "last_seen"; then
    echo "📝 Adding last_seen column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN last_seen DATETIME;"
fi

# Add created_at if missing
if ! column_exists "created_at"; then
    echo "📝 Adding created_at column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;"
fi

# Add referral_code if missing
if ! column_exists "referral_code"; then
    echo "📝 Adding referral_code column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN referral_code TEXT;"
fi

# Add total_volume if missing
if ! column_exists "total_volume"; then
    echo "📝 Adding total_volume column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN total_volume REAL DEFAULT 0;"
fi

# Add tx_count if missing
if ! column_exists "tx_count"; then
    echo "📝 Adding tx_count column..."
    sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN tx_count INTEGER DEFAULT 0;"
fi

echo "✅ Migration complete!"
echo ""
echo "Current schema:"
sqlite3 "$DB_PATH" "PRAGMA table_info(users);"
