import Database from 'better-sqlite3';
import path from 'path';
import { Beneficiary } from '../types';

console.log('Initializing Storage Service...');
const dbPath = path.resolve(__dirname, '../../zappy.db');
console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath);
console.log('Database connected.');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS beneficiaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    holder_name TEXT,
    bank_code TEXT,
    account_number TEXT,
    bank_name TEXT,
    wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    reference TEXT UNIQUE,
    type TEXT,
    asset TEXT,
    amount REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export const storageService = {
  getBeneficiaries: (userId: number): Beneficiary[] => {
    const stmt = db.prepare('SELECT * FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(userId) as any[];
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      holderName: row.holder_name,
      bankCode: row.bank_code,
      accountNumber: row.account_number,
      bankName: row.bank_name,
      walletAddress: row.wallet_address
    }));
  },

  addBeneficiary: (beneficiary: Beneficiary) => {
    const stmt = db.prepare(`
      INSERT INTO beneficiaries (user_id, holder_name, bank_code, account_number, bank_name, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      beneficiary.userId,
      beneficiary.holderName,
      beneficiary.bankCode,
      beneficiary.accountNumber,
      beneficiary.bankName,
      beneficiary.walletAddress || null
    );
    return result.lastInsertRowid;
  },

  getTransactionHistory: (userId: number, limit: number = 10, offset: number = 0) => {
    const stmt = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(userId, limit, offset) as any[];
  },

  addTransaction: (userId: number, reference: string, type: string, asset: string, amount: number) => {
    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, reference, type, asset, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, reference, type, asset, amount, 'PENDING');
  },

  updateTransactionStatus: (reference: string, status: string) => {
    const stmt = db.prepare('UPDATE transactions SET status = ? WHERE reference = ?');
    return stmt.run(status, reference);
  },

  getTransaction: (reference: string) => {
    const stmt = db.prepare('SELECT * FROM transactions WHERE reference = ?');
    return stmt.get(reference) as any;
  },

  // Basic user tracking (optional, but good for future)
  upsertUser: (id: number, username: string) => {
    const stmt = db.prepare(`
        INSERT INTO users (id, username) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET username = excluded.username
      `);
    stmt.run(id, username);
  }
};
