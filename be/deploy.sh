#!/bin/bash

# Deployment script for auth-be
set -e

# ==========================================
# Configuration
# ==========================================
APP_NAME="auth-be"

# Temp directory to backup .env file
ENV_BACKUP_DIR="/tmp/${APP_NAME}-env-backup-$$"

# Function to backup .env file before branch switch
backup_env() {
    echo "📦 Backing up .env file..."
    mkdir -p "$ENV_BACKUP_DIR"
    if [ -f ".env" ]; then
        cp ".env" "$ENV_BACKUP_DIR/.env"
        echo "✅ Backed up .env to $ENV_BACKUP_DIR"
    else
        echo "ℹ️  No .env file found to backup"
    fi
}

# Function to restore .env file from backup
restore_env() {
    echo ""
    echo "📝 Restoring .env file from backup..."
    
    if [ ! -d "$ENV_BACKUP_DIR" ]; then
        echo "⚠️  No backup found at $ENV_BACKUP_DIR"
        return
    fi
    
    local backup_file="$ENV_BACKUP_DIR/.env"
    
    if [ -f "$backup_file" ]; then
        cp "$backup_file" ".env"
        echo "  ✓ Restored .env"
    fi
    
    # Cleanup backup directory
    rm -rf "$ENV_BACKUP_DIR"
    echo "✅ Restored .env file from backup"
}

# Function to cleanup and switch back to original branch
cleanup_and_restore() {
    local exit_code=$?
    echo ""
    
    # Cleanup build archives
    rm -f be-source.tar.gz 2>/dev/null || true
    
    # Switch back to original branch if not already there
    local current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
    if [ -n "$ORIGINAL_BRANCH" ] && [ "$current_branch" != "$ORIGINAL_BRANCH" ]; then
        echo "🔄 Switching back to original branch: $ORIGINAL_BRANCH"
        git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
        echo "✅ Returned to branch: $ORIGINAL_BRANCH"
    fi
    
    # Always restore .env file
    restore_env
    
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "❌ Deployment failed with exit code: $exit_code"
    fi
    
    exit $exit_code
}

# Trap for signals
trap 'echo ""; echo "⚠️  Received SIGINT (Ctrl+C), cleaning up..."; exit 130' INT
trap 'echo ""; echo "⚠️  Received SIGTERM, cleaning up..."; exit 143' TERM

# Set trap to ensure cleanup runs on exit
trap cleanup_and_restore EXIT

read -p "Enter DEV | PROD: " env
env=$(echo "$env" | tr -d '\r')

# Setup Host and Env File
if [ "$env" == 'DEV' ]; then
    echo "Deploying DEV"
    HOST=72.62.198.196
    ENV_FILE=.env.dev
elif [ "$env" == 'PROD' ]; then
    echo "Deploying PROD"
    HOST=72.62.198.196
    ENV_FILE=.env.prod
else
    echo "❌ Invalid environment: '$env'"
    exit 1
fi

read -p "Enter SSH User (default: nguyenvanthanh): " SSH_USER
SSH_USER=$(echo "${SSH_USER:-nguyenvanthanh}" | tr -d '\r')

# SSH keepalive options to reduce broken pipe on long-running deploy steps
SSH_OPTIONS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes -o ConnectTimeout=20"

# Ask if user wants to reset database
read -p "Do you want to RESET database? (yes/no, default: no): " RESET_DB
RESET_DB=$(echo "${RESET_DB:-no}" | tr -d '\r' | tr '[:upper:]' '[:lower:]')

if [ "$RESET_DB" == "yes" ]; then
    echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
    read -p "Are you absolutely sure? Type 'CONFIRM' to proceed: " CONFIRM
    CONFIRM=$(echo "$CONFIRM" | tr -d '\r')
    if [ "$CONFIRM" != "CONFIRM" ]; then
        echo "❌ Database reset cancelled"
        RESET_DB="no"
    else
        echo "✅ Database reset confirmed"
    fi
else
    # Force RESET_DB to "no" if not explicitly set to yes
    RESET_DB="no"
fi

# Server path
SERVER_DIR="/srv/projects-deploy/${APP_NAME}"

# Save current branch for reference
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "ℹ️  Current branch: $ORIGINAL_BRANCH"

# Backup .env file
backup_env

# Prepare .env file for build
echo "📝 Preparing .env file for build..."
if [ -f "$ENV_FILE" ]; then
    echo "  Copying $ENV_FILE → .env"
    cp "$ENV_FILE" ".env"
fi
echo "✅ .env file prepared for build"

# Create archive of source code
echo "📦 Creating archive of source code..."
TAR_FILES="src prisma scripts package.json ecosystem.config.js nest-cli.json tsconfig.json tsconfig.build.json"

# Add optional files if they exist
[ -f "package-lock.json" ] && TAR_FILES="$TAR_FILES package-lock.json" && echo "  ✓ Including package-lock.json"
[ -f "yarn.lock" ] && TAR_FILES="$TAR_FILES yarn.lock" && echo "  ✓ Including yarn.lock"

tar -czf be-source.tar.gz $TAR_FILES

# Upload to server
echo "📤 Uploading..."
ssh $SSH_OPTIONS $SSH_USER@$HOST "mkdir -p $SERVER_DIR"

if [ -f "be-source.tar.gz" ]; then
    scp $SSH_OPTIONS be-source.tar.gz $SSH_USER@$HOST:$SERVER_DIR/
fi

# Upload .env file
if [ -f "$ENV_FILE" ]; then
    scp $SSH_OPTIONS $ENV_FILE $SSH_USER@$HOST:$SERVER_DIR/.env
fi

# Deploy on server
echo "🚀 Deploying on server..."
ssh $SSH_OPTIONS -T $SSH_USER@$HOST << EOF
cd $SERVER_DIR

# Extract source
if [ -f "be-source.tar.gz" ]; then
    echo "Extracting source..."
    rm -rf src prisma scripts package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json
    tar -xzf be-source.tar.gz
    rm -f be-source.tar.gz
fi

# Ensure Prisma 6 is installed (remove Prisma 7 if exists)
echo "📦 Ensuring Prisma 6..."
if command -v prisma >/dev/null 2>&1; then
    PRISMA_VERSION=\$(prisma --version 2>/dev/null | grep -oP 'prisma\\s+:\\s+\\K[0-9]+' | head -1)
    if [ "\$PRISMA_VERSION" = "7" ]; then
        echo "  Removing Prisma 7 global..."
        sudo npm uninstall -g prisma 2>/dev/null || true
        sudo npm install -g prisma@6.0.0
        echo "  ✓ Installed Prisma 6 globally"
    fi
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "📦 Generating Prisma client..."
npx prisma generate

# Reset database if requested
if [ "$RESET_DB" = "yes" ]; then
    echo "🗑️  Resetting database..."
    
    # Extract database credentials from DATABASE_URL
    DB_URL=\$(grep '^DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    if [ -z "\$DB_URL" ]; then
        echo "  ❌ Could not find DATABASE_URL in .env"
        exit 1
    fi
    
    # Parse DATABASE_URL
    DB_URL_CLEAN=\$(echo "\$DB_URL" | sed 's|^mysql://||')
    DB_USER=\$(echo "\$DB_URL_CLEAN" | cut -d':' -f1)
    DB_PASS=\$(echo "\$DB_URL_CLEAN" | sed 's|^[^:]*:||' | sed 's|@.*||')
    DB_HOST=\$(echo "\$DB_URL_CLEAN" | sed 's|.*@||' | cut -d':' -f1)
    DB_PORT=\$(echo "\$DB_URL_CLEAN" | sed 's|.*@[^:]*:||' | cut -d'/' -f1)
    DB_NAME=\$(echo "\$DB_URL_CLEAN" | sed 's|.*/||' | cut -d'?' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    echo "  Database: [\$DB_NAME]"
    echo "  Host: \$DB_HOST:\$DB_PORT"
    echo "  User: \$DB_USER"
    
    # Get list of tables
    echo "  Getting table list..."
    TABLES=\$(MYSQL_PWD="\$DB_PASS" mysql -u "\$DB_USER" -h "\$DB_HOST" -P "\$DB_PORT" "\$DB_NAME" -N -e "SHOW TABLES;" 2>/dev/null)
    
    if [ -n "\$TABLES" ]; then
        echo "  Found tables, creating drop script..."
        
        # Create a single SQL script that drops all tables in one transaction
        echo "SET FOREIGN_KEY_CHECKS = 0;" > /tmp/drop_all.sql
        
        for TABLE in \$TABLES; do
            echo "DROP TABLE IF EXISTS \\\`\$TABLE\\\`;" >> /tmp/drop_all.sql
        done
        
        echo "SET FOREIGN_KEY_CHECKS = 1;" >> /tmp/drop_all.sql
        
        echo "  Executing drop script..."
        MYSQL_PWD="\$DB_PASS" mysql -u "\$DB_USER" -h "\$DB_HOST" -P "\$DB_PORT" "\$DB_NAME" < /tmp/drop_all.sql
        
        if [ \$? -ne 0 ]; then
            echo "  ❌ Failed to drop tables"
            rm -f /tmp/drop_all.sql
            exit 1
        fi
        
        rm -f /tmp/drop_all.sql
        echo "  ✅ All tables dropped"
    else
        echo "  ℹ️  No tables found or database is empty"
    fi
    
    echo "  ✅ Database reset complete"
    
    echo "🌱 Running migrations from scratch..."
    npm run prisma:migrate:deploy:safe
    
    if [ \$? -ne 0 ]; then
        echo "  ❌ Failed to apply migrations"
        exit 1
    fi
    
    echo "  ✅ Migrations applied"
    
    echo "🌱 Seeding database..."
    npx prisma db seed
    
    if [ \$? -ne 0 ]; then
        echo "  ⚠️  Warning: Seeding failed or partially completed"
    else
        echo "  ✅ Database seeded"
    fi

    echo "🎵 Seeding music data..."
    if [ -f "prisma/seed-music.ts" ]; then
        npx ts-node prisma/seed-music.ts
        if [ \$? -ne 0 ]; then
            echo "  ⚠️  Warning: Music seed failed or partially completed"
        else
            echo "  ✅ Music data seeded"
        fi
    else
        echo "  ⚠️  Warning: prisma/seed-music.ts not found, skipping music seed"
    fi
else
    echo "📦 Running migrations..."
    npm run prisma:migrate:deploy:safe
    echo "  ✅ Migrations applied"
fi

echo "📦 Building application on server..."
npm run build

# Reload PM2
if [ -f "ecosystem.config.js" ]; then
    pm2 startOrReload ecosystem.config.js --update-env && pm2 save
fi

echo "✅ Deployed!"
pm2 list
EOF

echo ""
echo "✅ Deployment completed successfully!"
