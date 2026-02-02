import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.SWITCH_API_URL || 'https://api.onswitch.xyz';
const API_KEY = process.env.SWITCH_API_KEY;

async function run() {
    console.log('--- Switch API Institution Lookup Final Test ---');
    console.log('URL:', API_URL);

    // Using actual OPay details provided by user
    const payload = {
        country: 'NG',
        beneficiary: {
            bank_code: '100004',
            account_number: '7031632438'
        }
    };

    try {
        console.log('Sending request...');
        const res = await axios.post(`${API_URL}/institution/lookup`, payload, {
            headers: {
                'x-service-key': API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Status:', res.status);
        console.log('✅ Raw Keys in data:', Object.keys(res.data));
        console.log('✅ Full Response:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log('❌ Failed. Status:', e.response?.status);
        console.log('Error Data:', JSON.stringify(e.response?.data, null, 2));
    }
}

run();
