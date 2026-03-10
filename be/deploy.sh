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

# Function to cleanup
cleanup_and_restore() {
    local exit_code=$?
    echo ""
    
    # Cleanup build archives
    rm -f be-source.tar.gz 2>/dev/null || true
    
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
    HOST=68.183.179.100
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

# Server path
SERVER_DIR="/srv/projects-deploy/${APP_NAME}"

# Backup .env file
backup_env

# Auto Git Workflow
echo "🔄 Preparing Git changes..."
git add .
# Only commit if there are changes
if ! git diff-index --quiet HEAD --; then
    echo "📝 Committing changes..."
    git commit -m "Deploy BE: $(date '+%Y-%m-%d %H:%M:%S')"
else
    echo "ℹ️  No changes to commit"
fi

echo "� Syncing with remote master..."
git pull origin master --rebase

echo "�📤 Pushing to master..."
git push origin HEAD:master
echo "✅ Pushed to master"

# Sync local branch with master to be safe
git fetch origin master
git reset --hard origin/master

# Prepare .env file for build
echo "📝 Preparing .env file for build..."
if [ -f "$ENV_FILE" ]; then
    echo "  Copying $ENV_FILE → .env"
    cp "$ENV_FILE" ".env"
fi
echo "✅ .env file prepared for build"

# Create archive of source code
echo "📦 Creating archive of source code..."
TAR_FILES="src prisma package.json yarn.lock ecosystem.config.js nest-cli.json tsconfig.json tsconfig.build.json"
tar -czf be-source.tar.gz $TAR_FILES

# Upload to server
echo "📤 Uploading..."
ssh $SSH_USER@$HOST "mkdir -p $SERVER_DIR"

if [ -f "be-source.tar.gz" ]; then
    scp be-source.tar.gz $SSH_USER@$HOST:$SERVER_DIR/
fi

# Upload .env file
if [ -f "$ENV_FILE" ]; then
    scp $ENV_FILE $SSH_USER@$HOST:$SERVER_DIR/.env
fi

# Deploy on server
echo "🚀 Deploying on server..."
ssh $SSH_USER@$HOST << EOF
cd $SERVER_DIR

# Extract source
if [ -f "be-source.tar.gz" ]; then
    echo "Extracting source..."
    rm -rf src prisma package.json yarn.lock nest-cli.json tsconfig.json tsconfig.build.json
    tar -xzf be-source.tar.gz
    rm -f be-source.tar.gz
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
if command -v yarn >/dev/null 2>&1; then
    yarn install
    npx prisma generate
else
    echo "  ⚠️  yarn not found, using npm..."
    npm install
    npx prisma generate
fi

echo "📦 Building application on server..."
if command -v yarn >/dev/null 2>&1; then
    yarn build
else
    npm run build
fi

# Reload PM2
if [ -f "ecosystem.config.js" ]; then
    pm2 startOrReload ecosystem.config.js --update-env && pm2 save
fi

echo "✅ Deployed!"
pm2 list
EOF

echo ""
echo "✅ Deployment completed successfully!"
