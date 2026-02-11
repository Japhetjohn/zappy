
import { storageService } from './src/services/storage';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, 'bitnova.db');
const db = new Database(dbPath);

console.log('--- USERS ---');
const users = db.prepare('SELECT * FROM users LIMIT 5').all();
console.table(users);

console.log('\n--- BENEFICIARIES ---');
const beneficiaries = db.prepare('SELECT * FROM beneficiaries').all();
console.table(beneficiaries);

console.log('\n--- TRANSACTIONS ---');
const transactions = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5').all();
console.table(transactions);
