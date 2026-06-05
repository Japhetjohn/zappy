#!/bin/bash

# Simple deploy using tar + ssh (no zip/sshpass needed)
VPS_IP="72.61.97.210"
VPS_USER="root"
REMOTE_PATH="/root/usevelcro-bot"

echo "🚀 Deploying to $VPS_IP..."

# Package and transfer in one pipe using tar
echo "📦 Packaging & transferring files..."
tar czf - \
  src/ public/ package.json package-lock.json tsconfig.json ecosystem.config.js .env \
  --exclude='*.map' --exclude='node_modules' --exclude='dist' --exclude='logs' \
  | ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "
    mkdir -p $REMOTE_PATH
    cd $REMOTE_PATH
    tar xzf -
    rm -rf node_modules dist
    npm install --no-audit --no-fund
    npm run build
    if [ \$? -ne 0 ]; then
      echo '❌ Build failed!'
      exit 1
    fi
    mkdir -p logs
    pm2 delete bitnova-bot bitnova-watcher 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    echo '✨ Deployed successfully!'
  "

echo "✨ Done!"
