#!/bin/bash

# Deployment script for web-truyen-audio-fe
set -e

# ==========================================
# Configuration
# ==========================================
APP_NAME="web-truyen-audio-fe"

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

# Server path
SERVER_DIR="/srv/projects-deploy/${APP_NAME}"

# Save current branch
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "🔄 Current branch: $ORIGINAL_BRANCH"

# Backup .env file BEFORE switching branches
backup_env

# Auto Git Workflow (only for current directory)
echo "🔄 Preparing Git changes in current directory..."

# Check if there are any changes in current directory
if git diff --quiet . && git diff --cached --quiet .; then
    echo "ℹ️  No changes to commit in current directory"
else
    git add .
    git commit -m "Deploy FE: $(date '+%Y-%m-%d %H:%M:%S')" . || echo "ℹ️  Nothing to commit"
fi

echo "📤 Pushing to master..."
git push origin HEAD:master
echo "✅ Pushed to master"

# Sync local branch with master to be safe
echo "🔄 Fetching latest from origin/master..."
git fetch origin master

echo "🔄 Resetting to origin/master..."
git reset --hard origin/master
echo "✅ Local workspace is now synced with origin/master"

# Prepare .env file for build
echo "📝 Preparing .env file for build..."
if [ -f "$ENV_FILE" ]; then
    echo "  Copying $ENV_FILE → .env"
    cp "$ENV_FILE" ".env"
fi
echo "✅ .env file prepared for build"

# Clean old .next folder to avoid cache issues
echo "🗑️  Cleaning old .next folder to avoid cache issues..."
if [ -d ".next" ]; then
    rm -rf .next
    echo "  ✓ Removed .next folder"
else
    echo "  ℹ️  No .next folder found"
fi
echo "✅ .next folder cleaned"

# Create archive of source code
echo "📦 Creating archive of source code..."
TAR_FILES="src public messages next.config.ts package.json tsconfig.json tailwind.config.ts postcss.config.mjs ecosystem.config.js"

# Add optional files if they exist
[ -f "yarn.lock" ] && TAR_FILES="$TAR_FILES yarn.lock" && echo "  ✓ Including yarn.lock"
[ -f "package-lock.json" ] && TAR_FILES="$TAR_FILES package-lock.json" && echo "  ✓ Including package-lock.json"

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

# Extract source
if [ -f "next-source.tar.gz" ]; then
    echo "Extracting source..."
    rm -rf src public messages next.config.ts package.json yarn.lock package-lock.json tsconfig.json tailwind.config.ts postcss.config.mjs
    tar -xzf next-source.tar.gz
    rm -f next-source.tar.gz
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
if command -v yarn >/dev/null 2>&1; then
    yarn install
else
    echo "  ⚠️  yarn not found, using npm..."
    npm install
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
