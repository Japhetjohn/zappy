import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.SWITCH_API_URL || 'https://api.onswitch.xyz';
const API_KEY = process.env.SWITCH_API_KEY;

async function explore() {
    const endpoints = [
        { path: '/institution/lookup', method: 'POST' },
        { path: '/beneficiary/lookup', method: 'POST' },
        { path: '/account/lookup', method: 'POST' },
        { path: '/resolve-account', method: 'POST' },
        { path: '/beneficiary/resolve', method: 'POST' }
    ];

    const payload = {
        country: 'NG',
        beneficiary: {
            bank_code: '058',
            account_number: '0123456789'
        }
    };

    const flatPayload = {
        country: 'NG',
        bank_code: '058',
        account_number: '0123456789'
    };

    console.log('Exploring possible lookup endpoints...');

    for (const ep of endpoints) {
        try {
            console.log(`\nTesting ${ep.method} ${ep.path} (Nested)...`);
            const res = await axios({
                method: ep.method,
                url: `${API_URL}${ep.path}`,
                headers: { 'x-service-key': API_KEY, 'Content-Type': 'application/json' },
                data: payload
            });
            console.log(`✅ SUCCESS! Status: ${res.status}`);
            console.log('Data:', JSON.stringify(res.data, null, 2));
        } catch (e: any) {
            console.log(`❌ FAILED. Status: ${e.response?.status}`);
            if (e.response?.status === 400 || e.response?.status === 404) {
                // Try flat
                try {
                    console.log(`Testing ${ep.method} ${ep.path} (Flat)...`);
                    const res2 = await axios({
                        method: ep.method,
                        url: `${API_URL}${ep.path}`,
                        headers: { 'x-service-key': API_KEY, 'Content-Type': 'application/json' },
                        data: flatPayload
                    });
                    console.log(`✅ SUCCESS (Flat)! Status: ${res2.status}`);
                    console.log('Data:', JSON.stringify(res2.data, null, 2));
                } catch (e2: any) { }
            }
        }
    }
}

explore();
