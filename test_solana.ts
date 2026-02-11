
import axios from 'axios';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function getSignatures(address: string) {
    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [
                address,
                { limit: 5 }
            ]
        });
        return response.data;
    } catch (e: any) {
        console.error('RPC Error:', e.message);
        return null;
    }
}

const addresses = [
    '62THii8EncuZM6bHYfkHwh78iYYpwxBkzdLYMXkn7QDn',
    'CTs5qW6giAJkpACtwgYAAgs5b8dFY1EXaDEBZ9ncLsqr'
];

(async () => {
    for (const addr of addresses) {
        console.log(`Scanning ${addr}...`);
        const res = await getSignatures(addr);
        if (res && res.result) {
            console.log(`Found ${res.result.length} txs:`);
            res.result.forEach((tx: any) => {
                console.log(`- Hash: ${tx.signature}, Time: ${tx.blockTime}`);
            });
        } else {
            console.log('No result or error', res);
        }
    }
})();
