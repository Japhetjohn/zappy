
import { switchService } from './src/services/switch';
import { storageService } from './src/services/storage';
import { config } from './src/config';
import Database from 'better-sqlite3';
import path from 'path';

// Manual DB connection since storageService uses relative path which might break in standalone script
const dbPath = path.resolve(__dirname, 'bitnova.db');
const db = new Database(dbPath);

console.log('Cronjob Started: Checking for pending transactions older than 10 mins...');

const checkPending = async () => {
    // Get pending transactions
    const rows = db.prepare(`
        SELECT reference, created_at FROM transactions 
        WHERE status = 'PENDING' 
        AND created_at < datetime('now', '-10 minutes')
        AND created_at > datetime('now', '-24 hours')
    `).all() as any[];

    console.log(`Found ${rows.length} pending transactions to check.`);

    for (const tx of rows) {
        try {
            console.log(`Auto-confirming ${tx.reference}...`);
            await switchService.confirmDeposit(tx.reference);
            console.log(`✅ Confirmed ${tx.reference}`);
        } catch (e: any) {
            console.error(`❌ Failed ${tx.reference}: ${e.message}`);
        }
    }
};

checkPending().then(() => console.log('Cron check complete.'));
