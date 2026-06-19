#!/bin/bash

# Configuration
VPS_IP="72.61.97.210"
VPS_USER="root"
VPS_PASS="@Kuulsinim45"
REMOTE_PATH="/root/usevelcro-bot"
ZIP_FILE="deploy.tar.gz"

echo "🚀 Starting deployment to $VPS_IP..."

# 1. Build locally (SKIPPED - will build on VPS)
# echo "📦 Building project..."
# npm run build

# if [ $? -ne 0 ]; then
#     echo "❌ Build failed! Deployment aborted."
#     exit 1
# fi

# 2. Package files (including source for remote build)
echo "📦 Packaging files..."
# Construct target list based on existing files
TARGETS="src public package.json tsconfig.json ecosystem.config.js"
[ -d "scripts" ] && TARGETS="$TARGETS scripts"
[ -f ".env" ] && TARGETS="$TARGETS .env"

tar --exclude="*.map" -czf $ZIP_FILE $TARGETS

# 3. Transfer via scp
echo "📤 Transferring package to VPS..."
$HOME/.local/bin/sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no $ZIP_FILE "$VPS_USER@$VPS_IP:/root/"

# 4. Unzip and Setup on VPS
echo "⚙️ Setting up on VPS..."
SSHPASS="$VPS_PASS" $HOME/.local/bin/sshpass -e ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << EOF
    mkdir -p $REMOTE_PATH
    mv /root/$ZIP_FILE $REMOTE_PATH/
    cd $REMOTE_PATH
    tar -xzf $ZIP_FILE
    rm $ZIP_FILE
    rm -rf node_modules
    npm install --no-audit --no-fund
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed! Aborting deployment."
        exit 1
    fi

    mkdir -p logs
    # PM2 Management
    echo "🚀 Restarting apps via PM2..."
    pm2 delete usevelcro-bot usevelcro-watcher > /dev/null 2>&1 || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    echo "✨ Deployment successful!"
EOF

echo "✨ Deployment successful!"
rm $ZIP_FILE
