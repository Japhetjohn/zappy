"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
console.log('Initializing Storage Service...');
const dbPath = path_1.default.resolve(__dirname, '../../bitnova.db');
console.log(`Database path: ${dbPath}`);
const db = new better_sqlite3_1.default(dbPath);
console.log('Database connected.');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 30000000000');
db.pragma('page_size = 4096');
db.pragma('cache_size = -2000');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    referral_code TEXT,
    total_volume REAL DEFAULT 0,
    tx_count INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    reference TEXT UNIQUE,
    type TEXT,
    asset TEXT,
    amount REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(reference);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
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
        const check = db.prepare('SELECT id FROM beneficiaries WHERE user_id = ? AND bank_code = ? AND account_number = ?');
        const existing = check.get(beneficiary.userId, beneficiary.bankCode, beneficiary.accountNumber);
        if (existing)
            return existing.id;
        const stmt = db.prepare(`
      INSERT INTO beneficiaries (user_id, holder_name, bank_code, account_number, bank_name, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(beneficiary.userId, beneficiary.holderName, beneficiary.bankCode, beneficiary.accountNumber, beneficiary.bankName, beneficiary.walletAddress || null);
        return result.lastInsertRowid;
    },
    getTransactionHistory: (userId, limit = 10, offset = 0, statusFilters) => {
        let sql = 'SELECT * FROM transactions WHERE user_id = ?';
        const params = [userId];
        if (statusFilters && statusFilters.length > 0) {
            const placeholders = statusFilters.map(() => '?').join(',');
            sql += ` AND status IN (${placeholders})`;
            params.push(...statusFilters);
        }
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    },
    addTransaction: (userId, reference, type, asset, amount) => {
        const stmt = db.prepare(`
      INSERT INTO transactions (user_id, reference, type, asset, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(userId, reference, type, asset, amount, 'PENDING');
        db.prepare('UPDATE users SET tx_count = tx_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
        return result;
    },
    updateTransactionStatus: (reference, status) => {
        const stmt = db.prepare('UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?');
        const result = stmt.run(status, reference);
        if (status === 'COMPLETED') {
            const tx = db.prepare('SELECT user_id, amount FROM transactions WHERE reference = ?').get(reference);
            if (tx) {
                db.prepare('UPDATE users SET total_volume = total_volume + ? WHERE id = ?').run(tx.amount, tx.user_id);
            }
        }
        return result;
    },
    getTransaction: (reference) => {
        const stmt = db.prepare('SELECT * FROM transactions WHERE reference = ?');
        return stmt.get(reference);
    },
    upsertUser: (id, username, fullName) => {
        const stmt = db.prepare(`
        INSERT INTO users (id, username, full_name, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
            username = excluded.username,
            full_name = COALESCE(excluded.full_name, users.full_name),
            last_seen = CURRENT_TIMESTAMP
      `);
        stmt.run(id, username, fullName || null);
    },
    getStats: () => {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
        const successfulTxs = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'COMPLETED'").get().count;
        const totalVolume = db.prepare("SELECT SUM(amount) as sum FROM transactions WHERE status = 'COMPLETED'").get().sum || 0;
        return {
            totalUsers,
            totalTransactions,
            successfulTxs,
            totalVolume
        };
    }
};
//# sourceMappingURL=storage.js.map