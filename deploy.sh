#!/bin/bash

# Configuration
VPS_IP="72.61.97.210"
VPS_USER="root"
VPS_PASS="@Kuulsinim45"
REMOTE_PATH="/root/zappy-bot"

echo "🚀 Starting deployment to $VPS_IP..."

# 1. Build locally
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Deployment aborted."
    exit 1
fi

# 2. Sync files to VPS
echo "📤 Syncing files to VPS..."
sshpass -p "$VPS_PASS" rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'logs' \
    --exclude 'zappy.db' \
    --exclude 'deploy.sh' \
    ./ "$VPS_USER@$VPS_IP:$REMOTE_PATH"

# 3. Install dependencies and start/restart bot on VPS
echo "⚙️ Setting up on VPS..."
SSHPASS="$VPS_PASS" sshpass -e ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << EOF
    mkdir -p $REMOTE_PATH
    cd $REMOTE_PATH
    npm install --production --no-audit --no-fund
    mkdir -p logs
    # Use pm2 start or reload
    pm2 describe zappy-bot > /dev/null 2>&1
    if [ \$? -eq 0 ]; then
        echo "🔄 Reloading existing PM2 process..."
        pm2 reload ecosystem.config.js --env production
    else
        echo "🚀 Starting new PM2 process..."
        pm2 start ecosystem.config.js --env production
    fi
    pm2 save
EOF

echo "✨ Deployment successful!"
