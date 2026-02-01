import axios from 'axios';
import { config } from '../src/config';

async function checkTelegram() {
    console.log('Testing Telegram connectivity via Axios...');
    const url = `https://api.telegram.org/bot${config.botToken}/getMe`;
    console.log(`URL: ${url.replace(config.botToken, 'HIDDEN_TOKEN')}`);

    try {
        const start = Date.now();
        const response = await axios.get(url, { timeout: 10000 });
        const ms = Date.now() - start;
        console.log(`✅ Success! Headers received in ${ms}ms`);
        console.log('Response:', response.data);
    } catch (error: any) {
        console.error('❌ Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

checkTelegram();
