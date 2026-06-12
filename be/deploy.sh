#!/bin/bash

# Deployment script for auth-be
set -euo pipefail

# ==========================================
# Configuration
# ==========================================
APP_NAME="auth-be"
REQUIRED_NODE_VERSION="v24.16.0"
REQUIRED_YARN_VERSION="4.15.0"

# File to backup .env file
ENV_BACKUP_FILE=".env.deploy.backup"

ensure_yarn_toolchain() {
    local scope="$1"

    if ! command -v node >/dev/null 2>&1; then
        echo "❌ [$scope] Node.js is required"
        exit 1
    fi

    local current_node_version
    current_node_version="$(node -v)"
    if [ "$current_node_version" != "$REQUIRED_NODE_VERSION" ]; then
        echo "❌ [$scope] Node version mismatch. Expected $REQUIRED_NODE_VERSION, got $current_node_version"
        exit 1
    fi

    if ! command -v corepack >/dev/null 2>&1; then
        echo "❌ [$scope] Corepack is required to enforce Yarn $REQUIRED_YARN_VERSION"
        exit 1
    fi

    corepack enable
    corepack prepare "yarn@$REQUIRED_YARN_VERSION" --activate >/dev/null

    local current_yarn_version
    current_yarn_version="$(yarn --version)"
    if [ "$current_yarn_version" != "$REQUIRED_YARN_VERSION" ]; then
        echo "❌ [$scope] Yarn version mismatch. Expected $REQUIRED_YARN_VERSION, got $current_yarn_version"
        exit 1
    fi

    echo "✅ [$scope] Toolchain ready: Node $current_node_version / Yarn $current_yarn_version"
}

# Function to backup .env file before branch switch
backup_env() {
    echo "📦 Backing up .env file..."
    if [ -f ".env" ]; then
        cp ".env" "$ENV_BACKUP_FILE"
        echo "✅ Backed up .env to $ENV_BACKUP_FILE"
    else
        echo "ℹ️  No .env file found to backup"
    fi
}

# Function to restore .env file from backup
restore_env() {
    echo ""
    echo "📝 Restoring .env file from backup..."
    
    if [ ! -f "$ENV_BACKUP_FILE" ]; then
        echo "⚠️  No backup found at $ENV_BACKUP_FILE"
        return
    fi
    
    if [ -f "$ENV_BACKUP_FILE" ]; then
        cp "$ENV_BACKUP_FILE" ".env"
        echo "  ✓ Restored .env"
    fi
    
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

ensure_yarn_toolchain "local"

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
TAR_FILES="src prisma scripts package.json yarn.lock .yarnrc.yml .nvmrc ecosystem.config.js nest-cli.json tsconfig.json tsconfig.build.json"

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
    rm -rf src prisma scripts package.json package-lock.json yarn.lock .yarnrc.yml .nvmrc nest-cli.json tsconfig.json tsconfig.build.json
    tar -xzf be-source.tar.gz
    rm -f be-source.tar.gz
fi

export REQUIRED_NODE_VERSION="$REQUIRED_NODE_VERSION"
export REQUIRED_YARN_VERSION="$REQUIRED_YARN_VERSION"
$(typeset -f ensure_yarn_toolchain)
ensure_yarn_toolchain "server"

# Install dependencies and build
echo "📦 Installing dependencies..."
yarn install --immutable

echo "📦 Generating Prisma client..."
yarn prisma:generate

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
    yarn prisma:migrate:deploy:safe
    
    if [ \$? -ne 0 ]; then
        echo "  ❌ Failed to apply migrations"
        exit 1
    fi
    
    echo "  ✅ Migrations applied"
    
    echo "🌱 Seeding database..."
    yarn prisma:seed
    
    if [ \$? -ne 0 ]; then
        echo "  ⚠️  Warning: Seeding failed or partially completed"
    else
        echo "  ✅ Database seeded"
    fi

    echo "🎵 Seeding music data..."
    if [ -f "prisma/seed-music.ts" ]; then
        yarn ts-node prisma/seed-music.ts
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
    yarn prisma:migrate:deploy:safe
    echo "  ✅ Migrations applied"
fi

echo "📦 Building application on server..."
yarn build

# Reload PM2
if [ -f "ecosystem.config.js" ]; then
    pm2 startOrReload ecosystem.config.js --update-env && pm2 save
fi

echo "✅ Deployed!"
pm2 list
EOF

echo ""
echo "✅ Deployment completed successfully!"
