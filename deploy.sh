#!/bin/bash

# Configuration
VPS_IP="72.61.97.210"
VPS_USER="root"
VPS_PASS="@Kuulsinim45"
REMOTE_PATH="/root/usevelcro-bot"
ZIP_FILE="deploy.zip"

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
zip -r $ZIP_FILE src public scripts package.json tsconfig.json ecosystem.config.js .env -x "*.map"

# 3. Transfer via scp
echo "📤 Transferring package to VPS..."
sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no $ZIP_FILE "$VPS_USER@$VPS_IP:/root/"

# 4. Unzip and Setup on VPS
echo "⚙️ Setting up on VPS..."
SSHPASS="$VPS_PASS" sshpass -e ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << EOF
    mkdir -p $REMOTE_PATH
    mv /root/$ZIP_FILE $REMOTE_PATH/
    cd $REMOTE_PATH
    unzip -o $ZIP_FILE
    rm $ZIP_FILE
    rm -rf node_modules
    npm install --no-audit --no-fund
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed! Aborting deployment."
        exit 1
    fi

    mkdir -p logs
    # Safeguard: Ensure no orphaned processes are clinging to the bot token
    echo "🧹 Cleaning up potential conflicts..."
    ps aux | grep 'usevelcro-bot' | grep -v grep | awk '{print $2}' | xargs kill -9 > /dev/null 2>&1 || true

    pm2 describe usevelcro-bot > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "🔄 Reloading existing PM2 process..."
        pm2 reload ecosystem.config.js --env production
    else
        echo "🚀 Starting new PM2 process..."
        pm2 start ecosystem.config.js --env production
    fi
    pm2 save
    echo "✨ Deployment successful!"
EOF

echo "✨ Deployment successful!"
rm $ZIP_FILE
