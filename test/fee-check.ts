import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.SWITCH_API_KEY || 'T9bV4xN7hM3pW8zC5yF1kD6L';
const BASE_URL = 'https://api.onswitch.xyz';

async function checkFees() {
    console.log('--- Testing Developer Fees Endpoint ---');
    console.log(`URL: ${BASE_URL}/developer/fees`);

    // Testing various header formats again for this specific endpoint
    const configs = [
        { headers: { 'x-api-key': API_KEY } },
        { headers: { 'Authorization': `Bearer ${API_KEY}` } },
        { headers: { 'x-auth-token': API_KEY } },
        { headers: { 'x-service-key': API_KEY } },
        { headers: { 'X-Switch-API-Key': API_KEY } }
    ];

    for (const config of configs) {
        const headerName = Object.keys(config.headers)[0];
        console.log(`\nTrying with header: ${headerName}`);
        try {
            const response = await axios.get(`${BASE_URL}/developer/fees`, config);
            console.log('✅ SUCCESS!');
            console.log('Data:', JSON.stringify(response.data, null, 2));

            // Test withdrawal endpoint (guessing again)
            console.log('\n--- Testing Developer Fees Withdrawal Endpoint (POST /developer/fees) ---');
            console.log(`URL: ${BASE_URL}/developer/fees`);
            try {
                const withdrawResponse = await axios.post(`${BASE_URL}/developer/fees`, {
                    amount: 0.01,
                    currency: 'USD',
                    bank_code: '058',
                    account_number: '0123456789'
                }, config);
                console.log('✅ Withdrawal Success (or handled):', withdrawResponse.status);
            } catch (error: any) {
                console.log(`❌ Withdrawal Failed: ${error.response?.status || error.message}`);
                if (error.response?.data) {
                    console.log('Error data:', error.response.data);
                }
            }
            return;
        } catch (error: any) {
            console.log(`❌ Failed: ${error.response?.status || error.message}`);
            if (error.response?.data) {
                console.log('Error data:', error.response.data);
            }
        }
    }
}

checkFees();
