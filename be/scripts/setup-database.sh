#!/bin/bash

# Database setup script
# This script creates the database and runs migrations

set -e

echo "🗄️  Database Setup Script"
echo "========================"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Parse DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env"
    exit 1
fi

echo "📝 Parsing database connection..."

# Extract credentials using regex
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*mysql:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

# Check if MySQL client is available
if ! command -v mysql >/dev/null 2>&1; then
    echo "❌ MySQL client not installed!"
    echo "   Install with: sudo apt-get install mysql-client"
    exit 1
fi

# Test connection
echo ""
echo "🔌 Testing database connection..."
if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Connection successful"
else
    echo "❌ Cannot connect to MySQL server"
    echo "   Please check your credentials and ensure MySQL is running"
    exit 1
fi

# Create database
echo ""
echo "📦 Creating database '$DB_NAME'..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database created or already exists"
else
    echo "⚠️  Could not create database (may already exist)"
fi

# Grant privileges (if needed)
echo ""
echo "🔐 Setting up privileges..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%'; FLUSH PRIVILEGES;" 2>&1 || echo "⚠️  Could not grant privileges (may not have permission)"

# Run migrations
echo ""
echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "⚠️  Migrations failed, trying to push schema..."
    npx prisma db push --accept-data-loss
fi

# Verify tables
echo ""
echo "📊 Verifying database tables..."
TABLE_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | wc -l)

if [ "$TABLE_COUNT" -gt 1 ]; then
    echo "✅ Database has $((TABLE_COUNT - 1)) tables"
    echo ""
    echo "📋 Tables in database:"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -e "SHOW TABLES;"
else
    echo "⚠️  No tables found in database"
fi

# Check if database needs seeding
echo ""
echo "🌱 Checking if database needs seeding..."
USER_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
    echo "  📦 Database is empty, would you like to seed it? (y/n)"
    read -r SEED_CONFIRM
    SEED_CONFIRM=$(echo "$SEED_CONFIRM" | tr -d '\r')
    
    if [ "$SEED_CONFIRM" = "y" ] || [ "$SEED_CONFIRM" = "Y" ]; then
        echo "  🌱 Running seed..."
        npx prisma db seed
        
        if [ $? -eq 0 ]; then
            echo "  ✅ Seeding completed successfully"
        else
            echo "  ⚠️  Seeding failed"
        fi
    else
        echo "  ℹ️  Skipping seed"
    fi
else
    echo "  ℹ️  Database already has data ($USER_COUNT users), skipping seed"
fi

echo ""
echo "✅ Database setup completed!"
