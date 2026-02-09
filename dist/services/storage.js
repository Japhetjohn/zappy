"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
console.log('Initializing Storage Service...');
const dbPath = path_1.default.resolve(__dirname, '../../zappy.db');
console.log(`Database path: ${dbPath}`);
const db = new better_sqlite3_1.default(dbPath);
console.log('Database connected.');
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
exports.storageService = {
    getBeneficiaries: (userId) => {
        const stmt = db.prepare('SELECT * FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(userId);
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
    addBeneficiary: (beneficiary) => {
        const stmt = db.prepare(`
      INSERT INTO beneficiaries (user_id, holder_name, bank_code, account_number, bank_name, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(beneficiary.userId, beneficiary.holderName, beneficiary.bankCode, beneficiary.accountNumber, beneficiary.bankName, beneficiary.walletAddress || null);
        return result.lastInsertRowid;
    },
    getTransactionHistory: (userId) => {
        const stmt = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5');
        return stmt.all(userId);
    },
    addTransaction: (userId, reference, type, asset, amount) => {
        const stmt = db.prepare(`
      INSERT INTO transactions (user_id, reference, type, asset, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(userId, reference, type, asset, amount, 'PENDING');
    },
    updateTransactionStatus: (reference, status) => {
        const stmt = db.prepare('UPDATE transactions SET status = ? WHERE reference = ?');
        return stmt.run(status, reference);
    },
    upsertUser: (id, username) => {
        const stmt = db.prepare(`
        INSERT INTO users (id, username) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET username = excluded.username
      `);
        stmt.run(id, username);
    }
};
//# sourceMappingURL=storage.js.map