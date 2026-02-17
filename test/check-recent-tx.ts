
import { storageService } from '../src/services/storage';
import { config } from '../src/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = (storageService as any).db || require('better-sqlite3')(path.resolve(__dirname, '../bitnova.db'));

console.log('🔍 Checking Last 5 Transactions...');

try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5').all();
    console.table(rows);
} catch (e: any) {
    console.error('❌ Error:', e.message);
}
