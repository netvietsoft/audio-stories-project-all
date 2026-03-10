#!/bin/bash

# Deployment script for web-truyen-audio-fe
set -e

# ==========================================
# Configuration
# ==========================================
APP_NAME="web-truyen-audio-fe"

# Temp directory to backup .env file (assuming .env is used for production)
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
    rm -f next-source.tar.gz 2>/dev/null || true
    
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

# Setup Host and Env File
if [ "$env" == 'DEV' ]; then
    echo "Deploying DEV"
    HOST=68.183.179.100
    ENV_FILE=.env.dev
elif [ "$env" == 'PROD' ]; then
    echo "Deploying PROD"
    HOST=72.62.198.196
    ENV_FILE=.env.prod
else
    echo "❌ Invalid environment"
    exit 1
fi

read -p "Enter SSH User (default: nguyenvanthanh): " SSH_USER
SSH_USER=${SSH_USER:-nguyenvanthanh}

# Server path
SERVER_DIR="/srv/projects-deploy/${APP_NAME}"

# Save current branch and switch to main (or deploy branch)
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "🔄 Current branch: $ORIGINAL_BRANCH"

# Backup .env file BEFORE switching branches
backup_env

# Push changes (Requires push.sh)
if [ -f "./push.sh" ]; then
    ./push.sh
    echo "✅ Already push to main"
else
    echo "⚠️  push.sh not found, skipping..."
fi

# Sync with origin/main
echo "🔄 Fetching latest from origin/main..."
git fetch origin main

echo "🔄 Resetting main to origin/main..."
git reset --hard origin/main
echo "✅ main is now synced with origin/main"

# Prepare .env file for build
echo "📝 Preparing .env file for build..."
if [ -f "$ENV_FILE" ]; then
    echo "  Copying $ENV_FILE → .env"
    cp "$ENV_FILE" ".env"
fi
echo "✅ .env file prepared for build"

# Clean old .next folder
echo "🗑️  Cleaning old .next folder..."
rm -rf .next
echo "✅ .next folder cleaned"

# Create archive of source code
echo "📦 Creating archive of source code..."
TAR_FILES="src public next.config.ts package.json yarn.lock ecosystem.config.js tsconfig.json tailwind.config.ts postcss.config.mjs"
tar -czf next-source.tar.gz $TAR_FILES

# Upload to server
echo "📤 Uploading..."
ssh $SSH_USER@$HOST "mkdir -p $SERVER_DIR"

if [ -f "next-source.tar.gz" ]; then
    scp next-source.tar.gz $SSH_USER@$HOST:$SERVER_DIR/
fi

# Upload .env file
if [ -f "$ENV_FILE" ]; then
    scp $ENV_FILE $SSH_USER@$HOST:$SERVER_DIR/.env
fi

# Deploy on server
echo "🚀 Deploying on server..."
ssh $SSH_USER@$HOST << EOF
cd $SERVER_DIR

# Sync with latest origin/main
git fetch origin main
git reset --hard origin/main

# Extract source
if [ -f "next-source.tar.gz" ]; then
    echo "Extracting source..."
    rm -rf src public next.config.ts package.json yarn.lock tsconfig.json tailwind.config.ts postcss.config.mjs
    tar -xzf next-source.tar.gz
    rm -f next-source.tar.gz
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
yarn install

echo "📦 Building application on server..."
yarn build

# Reload PM2
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "✅ Deployed!"
pm2 list
EOF

echo ""
echo "✅ Deployment completed successfully!"
