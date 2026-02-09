import { startBot } from './bot';
import { startServer } from './server';
import logger from './utils/logger';

async function main() {
    try {
        // Start Webhook Server
        startServer();

        // Start Telegram Bot
        await startBot();
    } catch (err: any) {
        logger.error(`Critical startup failure: ${err.message}`);
        process.exit(1);
    }
}

main();
