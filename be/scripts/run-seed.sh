#!/bin/bash

# Safe seed runner with error handling
set -e

echo "🌱 Seed Runner Script"
echo "===================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Load environment
export $(cat .env | grep -v '^#' | xargs)

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env"
    exit 1
fi

echo "📝 Database: $(echo $DATABASE_URL | sed 's/:.*/.../')"

# Check if database exists
echo ""
echo "🔍 Checking database connection..."

DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*mysql:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "USE $DB_NAME;" 2>/dev/null; then
    echo "❌ Cannot connect to database '$DB_NAME'"
    echo "   Please ensure database exists and migrations are run"
    exit 1
fi

echo "✅ Database connection successful"

# Check if tables exist
echo ""
echo "📊 Checking database tables..."
TABLE_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | wc -l)

if [ "$TABLE_COUNT" -lt 2 ]; then
    echo "⚠️  Database has no tables!"
    echo "   Running migrations first..."
    npx prisma migrate deploy || {
        echo "❌ Migration failed"
        exit 1
    }
fi

# Check if already seeded
echo ""
echo "🔍 Checking if database is already seeded..."
USER_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" != "0" ]; then
    echo "⚠️  Database already has $USER_COUNT users"
    echo ""
    read -p "Do you want to re-seed? This may create duplicates (y/n): " CONFIRM
    CONFIRM=$(echo "$CONFIRM" | tr -d '\r')
    
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "ℹ️  Seed cancelled"
        exit 0
    fi
fi

# Run seed
echo ""
echo "🌱 Running seed script..."
echo "========================"

# Set admin credentials if not set
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@truyen-audio.app}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo "  Admin email: $ADMIN_EMAIL"
echo "  Admin password: $ADMIN_PASSWORD"
echo ""

# Run the seed
npx prisma db seed

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Seed completed successfully!"
    echo ""
    echo "📊 Database statistics:"
    echo "  Users: $(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM users;" 2>/dev/null)"
    echo "  Stories: $(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM stories;" 2>/dev/null)"
    echo "  Chapters: $(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM chapters;" 2>/dev/null)"
    echo "  Authors: $(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM authors;" 2>/dev/null)"
    echo "  Categories: $(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -se "SELECT COUNT(*) FROM categories;" 2>/dev/null)"
    echo ""
    echo "🔐 Admin credentials:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
else
    echo ""
    echo "❌ Seed failed!"
    exit 1
fi
