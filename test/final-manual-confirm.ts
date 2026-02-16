import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.SWITCH_API_KEY;
const BASE_URL = 'https://api.onswitch.xyz';

const requests = [
    {
        reference: "9a2fd65a-25a8-42e7-b4da-0f497c399837",
        hash: "57a8Qawa7WZRf6Wn9WJ8iA2yK8aaAS26VfwYpv28o5pEF9J2kBK1aomMi9VkQ8R5oaKe1EVVrEmrVT4UVFGE8AXk"
    }
];

async function confirm() {
    for (const req of requests) {
        console.log(`\n🚀 Confirming ${req.reference} with hash ${req.hash.substring(0, 10)}...`);
        try {
            const res = await axios.post(`${BASE_URL}/confirm`, {
                reference: req.reference,
                hash: req.hash
            }, {
                headers: { 'x-service-key': API_KEY }
            });
            console.log('✅ Response:', JSON.stringify(res.data, null, 2));
        } catch (e: any) {
            console.error('❌ Error:', e.response?.data?.message || e.message);
            if (e.response?.data) console.error('Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

confirm();
