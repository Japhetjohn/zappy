import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testTelegram() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
        console.error('❌ BOT_TOKEN not found in .env');
        return;
    }
    const url = `https://api.telegram.org/bot${token}/getMe`;

    console.log('Testing connection to:', `https://api.telegram.org/bot${token.substring(0, 10)}.../getMe`);

    try {
        const start = Date.now();
        const response = await axios.get(url, { timeout: 15000 });
        console.log('✅ Connection Successful!');
        console.log('Response Time:', Date.now() - start, 'ms');
        console.log('Data:', response.data);
    } catch (error: any) {
        console.error('❌ Connection Failed');
        if (error.code) console.error('Error Code:', error.code);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testTelegram();
