
import { switchService } from '../src/services/switch';
import { storageService } from '../src/services/storage';
import { notificationService } from '../src/services/notification';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function resolve() {
    // Allow passing reference via command line args, default to the reported one
    const ref = process.argv[2] || '8ac8bbbb-df2d-4149-bbd4-f6da6c26033c';

    console.log(`🔍 Checking transaction ${ref}...`);

    try {
        // 1. Get Status from Switch
        const status = await switchService.getStatus(ref);
        console.log('--- Switch API Status ---');
        console.log(JSON.stringify(status, null, 2));

        // 2. Get Local DB Transaction
        const tx = storageService.getTransaction(ref);
        if (!tx) {
            console.error('❌ Transaction not found in local DB!');
            return;
        }
        console.log(`--- Local DB Status ---`);
        console.log(`Current: ${tx.status} | Hash: ${tx.hash || 'None'}`);

        // 3. Determine Hash
        // Try all possible fields from Switch response
        const newHash = status.hash || status.txHash || status.transactionHash || status.tx_hash || status.blockchain_tx_id || status.transaction_id || tx.hash;

        // 4. Update DB if Status Changed or Hash Found causes mismatch
        if (tx.status !== status.status || (newHash && tx.hash !== newHash)) {
            console.log(`\n🔄 Syncing DB: ${tx.status} -> ${status.status}`);
            storageService.updateTransactionStatus(ref, status.status, newHash);
            console.log('✅ DB Updated!');

            // Notify if completed
            if (status.status === 'COMPLETED') {
                console.log('📩 Sending User Notification...');
                await notificationService.sendUpdate(tx.user_id, ref, 'COMPLETED', tx.asset, tx.amount, newHash);
            }
        } else {
            console.log('\n✅ DB is already in sync.');
        }

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
}

resolve();
