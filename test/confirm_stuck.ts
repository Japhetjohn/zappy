import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.SWITCH_API_KEY;
const BASE_URL = 'https://api.onswitch.xyz';
const ref = '9a2fd65a-25a8-42e7-b4da-0f497c399837';
const hash = '57a8Qawa7WZRf6Wn9WJ8iA2yK8aaAS26VfwYpv28o5pEF9J2kBK1aomMi9VkQ8R5oaKe1EVVrEmrVT4UVFGE8AXk';

async function confirm() {
    console.log(`Confirming ${ref} with hash: ${hash}`);
    try {
        const res = await axios.post(`${BASE_URL}/confirm`, {
            reference: ref,
            hash: hash
        }, {
            headers: { 'x-service-key': API_KEY }
        });
        console.log('✅ Success:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.error('❌ Failed:', JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

confirm();
