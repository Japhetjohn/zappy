import axios from 'axios';

async function testGoogle() {
    const url = `https://www.google.com`;
    console.log('Testing connection to:', url);

    try {
        const start = Date.now();
        const response = await axios.get(url, { timeout: 10000 });
        console.log('✅ Connection Successful!');
        console.log('Response Time:', Date.now() - start, 'ms');
    } catch (error: any) {
        console.error('❌ Connection Failed');
        console.error('Error Code:', error.code || 'UNKNOWN');
        console.error('Message:', error.message);
    }
}

testGoogle();
