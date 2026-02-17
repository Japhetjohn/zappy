
import { switchService } from '../src/services/switch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkStatus() {
    console.log('🔍 Diagnostics: Check Status...');

    // Pick a completed transaction ID from the logs
    const ref = '06c38f87-e62f-478c-91a9-8203f8b784f1';

    try {
        const status = await switchService.getStatus(ref);

        console.log('\n--- Status Result ---');
        console.log('Status:', status.status);
        console.log('Hash (Top Level):', status.hash);
        console.log('Tx Hash:', status.txHash);
        console.log('Transaction Hash:', status.transactionHash);
        console.log('Tx Hash (snake):', status.tx_hash);

        // Deep inspection
        console.log('\n--- Full Object Keys ---');
        console.log(Object.keys(status));

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
}

checkStatus();
