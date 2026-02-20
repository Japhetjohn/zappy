import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.SWITCH_API_KEY!;
const BASE_URL = process.env.SWITCH_API_URL || 'https://api.onswitch.xyz';
const SOLANA_WALLET = 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'x-service-key': API_KEY,
        'Content-Type': 'application/json',
    },
});

async function main() {
    // Step 1: Check available fees
    console.log('=== Step 1: Checking Developer Fees ===');
    try {
        const feesRes = await api.get('/developer/fees');
        console.log('Fees Response:', JSON.stringify(feesRes.data, null, 2));

        const fees = feesRes.data.data;
        console.log(`\n💰 Available: ${fees.amount} ${fees.currency}\n`);

        if (!fees.amount || fees.amount <= 0) {
            console.log('⚠️  No fees available to withdraw.');
            return;
        }
    } catch (err: any) {
        console.error('❌ Failed to check fees:', err.response?.data || err.message);
        return;
    }

    // Step 2: Withdraw to Solana wallet as USDC
    console.log('=== Step 2: Withdrawing to Solana Wallet ===');
    console.log(`Asset: solana:usdc`);
    console.log(`Wallet: ${SOLANA_WALLET}`);

    try {
        const payload = {
            asset: 'solana:usdc',
            beneficiary: {
                wallet_address: SOLANA_WALLET,
            },
        };
        console.log('\nPayload:', JSON.stringify(payload, null, 2));

        const res = await api.post('/developer/withdraw', payload);
        console.log('\n✅ Withdrawal Successful!');
        console.log(JSON.stringify(res.data, null, 2));

        if (res.data.data) {
            const d = res.data.data;
            console.log(`\n🎉 Amount: ${d.amount}`);
            if (d.hash) console.log(`🔗 TX Hash: ${d.hash}`);
            if (d.explorer_url) console.log(`🌐 Explorer: ${d.explorer_url}`);
        }
    } catch (err: any) {
        console.error('\n❌ Withdrawal Failed!');
        console.error('Status:', err.response?.status);
        console.error('Error:', JSON.stringify(err.response?.data || err.message, null, 2));
    }
}

main();
