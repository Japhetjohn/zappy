
import { switchService } from '../src/services/switch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkQuote() {
    console.log('🔍 Diagnostics: Check Fee Comparison...');

    const amount = 100000;
    const variations = [0, 0.5, 1, 5];

    console.log('--- STARTING SEQUENTIAL COMPARISON ---');

    for (const fee of variations) {
        try {
            // @ts-ignore
            const payload = {
                amount,
                country: 'NG',
                asset: 'solana:usdt',
                currency: 'NGN',
                channel: 'BANK',
                developer_fee: fee,
                developer_wallet: 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV'
            };

            const response = await (switchService as any).api.post('/onramp/quote', payload);
            const quote = response.data.data;

            console.log(`\n👉 Fee: ${fee}%`);
            console.log(`   Pay: ${quote.source.amount}`);
            console.log(`   Get: ${quote.destination.amount}`);
            const implied = quote.source.amount / quote.destination.amount;
            console.log(`   Rate: ${implied.toFixed(4)}`);

        } catch (e: any) {
            console.error(`❌ Error for ${fee}:`, e.message);
        }
    }
}

checkQuote();
