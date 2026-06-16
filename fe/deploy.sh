#!/bin/bash

set -euo pipefail

APP_NAME="web-truyen-audio-fe"
WEB_PM2_NAME="web-truyen-audio-web"
ADMIN_PM2_NAME="web-truyen-audio-admin"
ARCHIVE_NAME="next-source.tar.gz"
REQUIRED_NODE_VERSION="v24.16.0"
REQUIRED_YARN_VERSION="4.15.0"

resolve_env_file() {
    local primary="$1"
    local legacy="$2"

    if [ -f "$primary" ]; then
        echo "$primary"
        return 0
    fi

    if [ -f "$legacy" ]; then
        echo "$legacy"
        return 0
    fi

    return 1
}

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

read -p "Enter DEV | PROD: " env
env=$(echo "$env" | tr -d '\r')

if [ "$env" = "DEV" ]; then
    echo "Deploying DEV"
    HOST=72.62.198.196
    WEB_PRIMARY_ENV_FILE="apps/web/.env.development"
    WEB_LEGACY_ENV_FILE="apps/web/.env.dev"
    ADMIN_PRIMARY_ENV_FILE="apps/admin/.env.development"
    ADMIN_LEGACY_ENV_FILE="apps/admin/.env.dev"
elif [ "$env" = "PROD" ]; then
    echo "Deploying PROD"
    HOST=72.62.198.196
    WEB_PRIMARY_ENV_FILE="apps/web/.env.production"
    WEB_LEGACY_ENV_FILE="apps/web/.env.prod"
    ADMIN_PRIMARY_ENV_FILE="apps/admin/.env.production"
    ADMIN_LEGACY_ENV_FILE="apps/admin/.env.prod"
else
    echo "❌ Invalid environment: '$env'"
    exit 1
fi

WEB_ENV_FILE=$(resolve_env_file "$WEB_PRIMARY_ENV_FILE" "$WEB_LEGACY_ENV_FILE") || {
    echo "❌ Web env file not found. Expected '$WEB_PRIMARY_ENV_FILE' (or legacy '$WEB_LEGACY_ENV_FILE')"
    exit 1
}

ADMIN_ENV_FILE=$(resolve_env_file "$ADMIN_PRIMARY_ENV_FILE" "$ADMIN_LEGACY_ENV_FILE") || {
    echo "❌ Admin env file not found. Expected '$ADMIN_PRIMARY_ENV_FILE' (or legacy '$ADMIN_LEGACY_ENV_FILE')"
    exit 1
}

WEB_API_URL=$(grep '^NEXT_PUBLIC_API_URL=' "$WEB_ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)
ADMIN_API_URL=$(grep '^NEXT_PUBLIC_API_URL=' "$ADMIN_ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)
WEB_SITE_URL=$(grep '^NEXT_PUBLIC_SITE_URL=' "$WEB_ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)
ADMIN_SITE_URL=$(grep '^NEXT_PUBLIC_SITE_URL=' "$ADMIN_ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)

if [ -z "$WEB_API_URL" ] || [ -z "$ADMIN_API_URL" ]; then
    echo "❌ NEXT_PUBLIC_API_URL is missing in one of the app env files"
    exit 1
fi

if [ -z "$WEB_SITE_URL" ] || [ -z "$ADMIN_SITE_URL" ]; then
    echo "❌ NEXT_PUBLIC_SITE_URL is missing in one of the app env files"
    exit 1
fi

echo "🌐 Web NEXT_PUBLIC_API_URL=$WEB_API_URL"
echo "🌐 Admin NEXT_PUBLIC_API_URL=$ADMIN_API_URL"
echo "🌐 Web NEXT_PUBLIC_SITE_URL=$WEB_SITE_URL"
echo "🌐 Admin NEXT_PUBLIC_SITE_URL=$ADMIN_SITE_URL"

read -p "Enter SSH User (default: nguyenvanthanh): " SSH_USER
SSH_USER=$(echo "${SSH_USER:-nguyenvanthanh}" | tr -d '\r')

SERVER_DIR="/srv/projects-deploy/${APP_NAME}"
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "ℹ️  Current branch: $ORIGINAL_BRANCH"

ensure_yarn_toolchain "local"

echo "🗑️  Cleaning generated outputs before packaging..."
rm -rf .moon/cache apps/web/.next apps/admin/.next packages/shared/dist packages/ui/dist packages/api-client/dist

echo "📦 Creating workspace archive..."
TAR_FILES=(
    apps
    packages
    .moon
    package.json
    yarn.lock
    .yarnrc.yml
    .nvmrc
    tsconfig.base.json
    ecosystem.config.js
    deploy.sh
)

tar \
  --exclude='apps/*/.env*' \
  --exclude='.moon/cache' \
  --exclude='apps/*/.next' \
  --exclude='packages/*/dist' \
  -czf "$ARCHIVE_NAME" "${TAR_FILES[@]}"

echo "📤 Uploading workspace archive..."
ssh "$SSH_USER@$HOST" "mkdir -p '$SERVER_DIR/apps/web' '$SERVER_DIR/apps/admin' '$SERVER_DIR/logs'"
scp "$ARCHIVE_NAME" "$SSH_USER@$HOST:$SERVER_DIR/$ARCHIVE_NAME"
scp "$WEB_ENV_FILE" "$SSH_USER@$HOST:$SERVER_DIR/apps/web/.env"
scp "$ADMIN_ENV_FILE" "$SSH_USER@$HOST:$SERVER_DIR/apps/admin/.env"

echo "🚀 Deploying on server..."
ssh "$SSH_USER@$HOST" << EOF_REMOTE
cd "$SERVER_DIR"

if [ -f "$ARCHIVE_NAME" ]; then
    echo "Extracting workspace..."
    rm -rf apps packages .moon .yarn package.json yarn.lock .yarnrc.yml .nvmrc tsconfig.base.json ecosystem.config.js deploy.sh src public messages next.config.ts tailwind.config.ts postcss.config.mjs tsconfig.json eslint.config.mjs
    tar -xzf "$ARCHIVE_NAME"
    rm -f "$ARCHIVE_NAME"
fi

mkdir -p logs apps/web apps/admin

# Load fnm (Fast Node Manager) — non-interactive SSH does not source ~/.bashrc,
# so the user's fnm-managed Node is invisible by default. Inject PATH + env here.
if [ -x "\$HOME/.local/share/fnm/fnm" ]; then
    export PATH="\$HOME/.local/share/fnm:\$PATH"
    eval "\$(fnm env --shell bash)"
    fnm use "$REQUIRED_NODE_VERSION" 2>/dev/null || fnm use default 2>/dev/null || true
fi

export REQUIRED_NODE_VERSION="$REQUIRED_NODE_VERSION"
export REQUIRED_YARN_VERSION="$REQUIRED_YARN_VERSION"
$(typeset -f ensure_yarn_toolchain)
ensure_yarn_toolchain "server"

echo "📦 Installing dependencies..."
yarn install --immutable

echo "📦 Building workspace..."
yarn build

if [ -f "ecosystem.config.js" ]; then
    pm2 startOrReload ecosystem.config.js --only "$WEB_PM2_NAME,$ADMIN_PM2_NAME" --update-env
    pm2 save
fi

echo "✅ Deployed!"
pm2 list
EOF_REMOTE

rm -f "$ARCHIVE_NAME"

echo ""
echo "✅ Deployment completed successfully!"
