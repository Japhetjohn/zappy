import axios from 'axios';
import { config } from './src/config';

async function test(name: string, url: string) {
    console.log(`\n--- Testing ${name} ---`);
    console.log('URL:', url.replace(config.botToken, '[TOKEN]'));
    try {
        const start = Date.now();
        await axios.get(url, { timeout: 10000 });
        console.log(`✅ SUCCESS! (${Date.now() - start}ms)`);
    } catch (error: any) {
        console.error(`❌ FAILED! [${error.code || 'UNKNOWN'}]`);
        console.error('Message:', error.message);
    }
}

async function run() {
    await test('Telegram API', `https://api.telegram.org/bot${config.botToken}/getMe`);
    await test('Switch API', config.switch.baseUrl);
}

run();
