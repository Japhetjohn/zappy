import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testSwitch() {
    const url = process.env.SWITCH_API_URL || 'https://api.onswitch.xyz';
    console.log('Testing connection to:', url);

    try {
        const start = Date.now();
        const response = await axios.get(`${url}/asset`, {
            headers: { 'x-service-key': process.env.SWITCH_SERVICE_KEY },
            timeout: 10000
        });
        console.log('✅ Connection Successful!');
        console.log('Response Time:', Date.now() - start, 'ms');
    } catch (error: any) {
        console.error('❌ Connection Failed');
        console.error('Error Code:', error.code || 'UNKNOWN');
        console.error('Message:', error.message);
    }
}

testSwitch();
