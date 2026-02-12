
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('No BOT_TOKEN found in .env');
    process.exit(1);
}

const bot = new Telegraf(token);

async function clearWebhook() {
    try {
        console.log('Getting webhook info...');
        const info = await bot.telegram.getWebhookInfo();
        console.log('Current Webhook Info:', info);

        console.log('Deleting webhook...');
        const result = await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('Delete Result:', result);

        console.log('Verifying...');
        const newInfo = await bot.telegram.getWebhookInfo();
        console.log('New Webhook Info:', newInfo);

        console.log('✅ Webhook cleared successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error clearing webhook:', err);
        process.exit(1);
    }
}

clearWebhook();
