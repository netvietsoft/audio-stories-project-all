#!/bin/bash

set -euo pipefail

WEB_PM2_NAME="web-truyen-audio-web"
ADMIN_PM2_NAME="web-truyen-audio-admin"
ARCHIVE_NAME="next-source.tar.gz"
REQUIRED_NODE_VERSION="v24.16.0"
REQUIRED_YARN_VERSION="4.15.0"

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

# Staging/prod uses a single env per app (.env.production). There is no DEV/PROD
# split — local dev uses .env.local and is never deployed.
WEB_ENV_FILE="apps/web/.env.production"
ADMIN_ENV_FILE="apps/admin/.env.production"

for f in "$WEB_ENV_FILE" "$ADMIN_ENV_FILE"; do
    if [ ! -f "$f" ]; then
        echo "❌ Env file not found: $f (create it from $f.example)"
        exit 1
    fi
done

# Target server (BE and FE share the same server). Allow overriding the IP.
DEFAULT_HOST=72.62.198.196
read -p "Enter server IP/host (default: $DEFAULT_HOST): " INPUT_HOST
HOST=$(echo "${INPUT_HOST:-$DEFAULT_HOST}" | tr -d '\r')

read -p "Enter SSH User (default: netviet): " SSH_USER
SSH_USER=$(echo "${SSH_USER:-netviet}" | tr -d '\r')

# Validate the public URLs Next.js inlines at build time are present.
get_env() { grep "^$1=" "$2" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true; }
WEB_API_URL=$(get_env NEXT_PUBLIC_API_URL "$WEB_ENV_FILE")
ADMIN_API_URL=$(get_env NEXT_PUBLIC_API_URL "$ADMIN_ENV_FILE")
WEB_SITE_URL=$(get_env NEXT_PUBLIC_SITE_URL "$WEB_ENV_FILE")
ADMIN_SITE_URL=$(get_env NEXT_PUBLIC_SITE_URL "$ADMIN_ENV_FILE")

if [ -z "$WEB_API_URL" ] || [ -z "$ADMIN_API_URL" ] || [ -z "$WEB_SITE_URL" ] || [ -z "$ADMIN_SITE_URL" ]; then
    echo "❌ NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SITE_URL missing in an app .env.production"
    exit 1
fi

echo "🌐 Web   API=$WEB_API_URL  SITE=$WEB_SITE_URL"
echo "🌐 Admin API=$ADMIN_API_URL  SITE=$ADMIN_SITE_URL"

SERVER_DIR="/home/netviet/projects-deploy/audio-stories-project-all/fe"
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
ssh "$SSH_USER@$HOST" "mkdir -p '$SERVER_DIR'"
scp "$ARCHIVE_NAME" "$SSH_USER@$HOST:$SERVER_DIR/$ARCHIVE_NAME"
# Upload env to temp files at the deploy root. Uploading straight to
# apps/*/.env would be wiped by the remote `rm -rf apps` below, so we move them
# into place AFTER extraction (Next.js loads apps/<app>/.env.production at build).
scp "$WEB_ENV_FILE" "$SSH_USER@$HOST:$SERVER_DIR/.env.web.production"
scp "$ADMIN_ENV_FILE" "$SSH_USER@$HOST:$SERVER_DIR/.env.admin.production"

echo "🚀 Deploying on server..."
ssh "$SSH_USER@$HOST" << EOF_REMOTE
cd "$SERVER_DIR"

if [ ! -f "$ARCHIVE_NAME" ]; then
    echo "  ❌ archive $ARCHIVE_NAME not found on server — aborting"; exit 1
fi
echo "Extracting workspace..."
rm -rf apps packages .moon .yarn package.json yarn.lock .yarnrc.yml .nvmrc tsconfig.base.json ecosystem.config.js deploy.sh src public messages next.config.ts tailwind.config.ts postcss.config.mjs tsconfig.json eslint.config.mjs
if ! tar -xzf "$ARCHIVE_NAME"; then echo "  ❌ archive extraction failed — aborting"; exit 1; fi
rm -f "$ARCHIVE_NAME"

mkdir -p logs apps/web apps/admin

# Move uploaded env into place (these sit at the deploy root so the rm -rf above
# does not wipe them). Next.js inlines NEXT_PUBLIC_* from .env.production at build
# (NODE_ENV=production). Fail closed if an env file is missing — never build env-less.
for app in web admin; do
    if [ -f ".env.\$app.production" ]; then
        mv -f ".env.\$app.production" "apps/\$app/.env.production"
        echo "  ✓ apps/\$app/.env.production in place"
    else
        echo "  ❌ uploaded .env.\$app.production missing on server — aborting"; exit 1
    fi
done

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

# The SSH heredoc has no `set -e`, so guard must-succeed steps explicitly.
echo "📦 Installing dependencies..."
if ! yarn install --immutable; then echo "  ❌ yarn install failed — aborting"; exit 1; fi

echo "📦 Building workspace..."
if ! yarn build; then echo "  ❌ build failed — aborting (PM2 not reloaded)"; exit 1; fi

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
