
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/health`;
const INTERVAL = 60000; // 60 seconds

console.log(`Starting Bitnova Watcher... Monitoring ${HEALTH_URL}`);

let failureCount = 0;

const checkHealth = async () => {
    try {
        const start = Date.now();
        const response = await axios.get(HEALTH_URL, { timeout: 5000 });
        const latency = Date.now() - start;

        if (response.status === 200) {
            // Success - reset failure count
            if (failureCount > 0) {
                console.log(`✅ Bot recovered after ${failureCount} failures! Latency: ${latency}ms`);
                failureCount = 0;
            }
            // Optional: Log success only occasionally to avoid spam
            // console.log(`💓 Bot is healthy. Latency: ${latency}ms`);
        } else {
            throw new Error(`Status ${response.status}`);
        }
    } catch (error: any) {
        failureCount++;
        console.error(`⚠️ Health check failed (${failureCount}/5): ${error.message}`);

        if (failureCount >= 5) {
            console.error('🚨 BOT IS UNARESPONSIVE FOR 5 MINUTES! 🚨');
            // Here we could trigger a restart command exec('pm2 restart bitnova-bot')
            // But strict restart policies are safer handled by PM2 manually for now
        }
    }
};

// Initial check
checkHealth();

// Scheduled check
setInterval(checkHealth, INTERVAL);
