
import { switchService } from '../src/services/switch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkQuote() {
    console.log('🔍 Diagnostics: Check Fee Comparison...');

    const amount = 100000;
    const variations = [0, 0.4, 1, 10]; // 0%, 0.4%, 1%, 10%

    for (const fee of variations) {
        try {
            // @ts-ignore
            const quote = await switchService.getOnrampQuote(amount, 'NG', 'solana:usdt', 'NGN', fee);

            console.log(`\n👉 Fee: ${fee}%`);
            console.log(`   Pay: ${quote.source.amount} ${quote.source.currency}`);
            console.log(`   Get: ${quote.destination.amount} ${quote.destination.currency}`);

            const impliedRate = quote.source.amount / quote.destination.amount;
            console.log(`   Implied Rate: ${impliedRate.toFixed(4)}`);

        } catch (e: any) {
            console.error('❌ Error:', e.message);
        }
    }
}

checkQuote();
