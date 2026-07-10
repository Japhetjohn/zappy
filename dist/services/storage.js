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
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    referral_count INTEGER DEFAULT 0,
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
    currency TEXT DEFAULT 'USD',
    status TEXT,
    hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(reference);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    wallet_address TEXT,
    chain TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN wallet_address TEXT').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE users ADD COLUMN referral_balance REAL DEFAULT 0').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE users ADD COLUMN total_referral_earnings REAL DEFAULT 0').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE users ADD COLUMN referred_by INTEGER').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN hash TEXT').run();
}
catch (e) { }
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);
const defaultSettings = [
    { key: 'platform_fee', value: '1' },
];
for (const setting of defaultSettings) {
    try {
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(setting.key, setting.value);
    }
    catch (e) { }
}
try {
    const feeRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_fee'").get();
    if (feeRow && (feeRow.value === '4.5' || feeRow.value === '4.50')) {
        db.prepare("UPDATE settings SET value = '1' WHERE key = 'platform_fee'").run();
        console.log('[STORAGE] Migrated platform_fee from 4.5 to 1');
    }
}
catch (e) { }
try {
    const usersWithoutCode = db.prepare("SELECT id FROM users WHERE referral_code IS NULL").all();
    for (const user of usersWithoutCode) {
        const code = generateUniqueReferralCode(user.id);
        db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, user.id);
    }
    if (usersWithoutCode.length > 0) {
        console.log(`[STORAGE] Backfilled ${usersWithoutCode.length} referral codes`);
    }
}
catch (e) { }
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
function generateUniqueReferralCode(userId) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateReferralCode();
        const existing = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
        if (!existing)
            return code;
    }
    return `REF${userId}`;
}
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
        if (existing) {
            console.log(`[STORAGE] Duplicate beneficiary found for user ${beneficiary.userId}, skipping save.`);
            return existing.id;
        }
        const stmt = db.prepare(`
      INSERT INTO beneficiaries (user_id, holder_name, bank_code, account_number, bank_name, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        try {
            const result = stmt.run(beneficiary.userId, beneficiary.holderName, beneficiary.bankCode, beneficiary.accountNumber, beneficiary.bankName, beneficiary.walletAddress || null);
            console.log(`[STORAGE] Saved beneficiary for user ${beneficiary.userId}, ID: ${result.lastInsertRowid}`);
            return result.lastInsertRowid;
        }
        catch (e) {
            console.error(`[STORAGE] Failed to save beneficiary: ${e.message}`);
            throw e;
        }
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
    addTransaction: (data) => {
        const stmt = db.prepare(`
      INSERT INTO transactions (user_id, reference, type, asset, amount, currency, status, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.userId, data.reference, data.type, data.asset, data.amount, data.currency || 'USD', data.status || 'PENDING', data.walletAddress || null);
        db.prepare('UPDATE users SET tx_count = tx_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(data.userId);
        return result;
    },
    updateTransactionStatus: (reference, status, hash) => {
        let sql = 'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP';
        const params = [status];
        if (hash) {
            sql += ', hash = ?';
            params.push(hash);
        }
        sql += ' WHERE reference = ?';
        params.push(reference);
        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        if (status === 'COMPLETED') {
            const tx = db.prepare('SELECT user_id, amount, currency, type FROM transactions WHERE reference = ?').get(reference);
            if (tx) {
                let volumeUSD = tx.amount;
                if (tx.currency === 'NGN') {
                    volumeUSD = tx.amount / 1600;
                }
                db.transaction(() => {
                    db.prepare('UPDATE users SET total_volume = total_volume + ? WHERE id = ?')
                        .run(volumeUSD, tx.user_id);
                    const user = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(tx.user_id);
                    if (user && user.referred_by) {
                        const rewardAmountUSD = volumeUSD * 0.001;
                        if (rewardAmountUSD > 0) {
                            db.prepare('UPDATE users SET referral_balance = referral_balance + ?, total_referral_earnings = total_referral_earnings + ? WHERE id = ?')
                                .run(rewardAmountUSD, rewardAmountUSD, user.referred_by);
                            setTimeout(() => {
                                try {
                                    const { notificationService } = require('./notification');
                                    notificationService.sendReferralCreditNotification(user.referred_by, rewardAmountUSD);
                                }
                                catch (e) { }
                            }, 100);
                        }
                    }
                })();
            }
        }
        return result;
    },
    getTransaction: (reference) => {
        const stmt = db.prepare('SELECT * FROM transactions WHERE reference = ?');
        return stmt.get(reference);
    },
    upsertUser: (id, username, fullName) => {
        const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
        if (!existing) {
            const referralCode = generateUniqueReferralCode(id);
            const stmt = db.prepare(`
        INSERT INTO users (id, username, full_name, referral_code, last_seen)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            stmt.run(id, username, fullName || null, referralCode);
            return true;
        }
        else {
            const stmt = db.prepare(`
        UPDATE users SET
          username = ?,
          full_name = COALESCE(?, full_name),
          last_seen = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
            stmt.run(username, fullName || null, id);
            return false;
        }
    },
    getUserByReferralCode: (code) => {
        return db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code);
    },
    getAllUserIds: () => {
        return db.prepare('SELECT id FROM users ORDER BY id').all();
    },
    getUserReferralStats: (userId) => {
        let user = db.prepare('SELECT referral_code, referral_count, referral_balance, total_referral_earnings FROM users WHERE id = ?').get(userId);
        if (!user) {
            return { code: null, referralCount: 0, balance: 0, totalEarned: 0 };
        }
        if (!user.referral_code) {
            const code = generateUniqueReferralCode(userId);
            db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, userId);
            user.referral_code = code;
        }
        return {
            code: user.referral_code,
            referralCount: (user === null || user === void 0 ? void 0 : user.referral_count) || 0,
            balance: (user === null || user === void 0 ? void 0 : user.referral_balance) || 0,
            totalEarned: (user === null || user === void 0 ? void 0 : user.total_referral_earnings) || 0,
        };
    },
    requestWithdrawal: (userId, amount, address, chain) => {
        return db.transaction(() => {
            const user = db.prepare('SELECT referral_balance FROM users WHERE id = ?').get(userId);
            if (!user || user.referral_balance < amount)
                throw new Error('Insufficient referral balance');
            db.prepare('UPDATE users SET referral_balance = referral_balance - ? WHERE id = ?').run(amount, userId);
            const result = db.prepare('INSERT INTO withdrawals (user_id, amount, wallet_address, chain, status) VALUES (?, ?, ?, ?, ?)').run(userId, amount, address, chain, 'PENDING');
            return result.lastInsertRowid;
        })();
    },
    recordReferral: (referredUserId, referrerUserId) => {
        const referred = db.prepare('SELECT id, referred_by FROM users WHERE id = ?').get(referredUserId);
        if (!referred || referred.referred_by)
            return false;
        if (referredUserId === referrerUserId)
            return false;
        return db.transaction(() => {
            db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrerUserId, referredUserId);
            const result = db.prepare('UPDATE users SET referral_count = referral_count + 1 WHERE id = ?').run(referrerUserId);
            return result.changes > 0;
        })();
    },
    getReferralStats: () => {
        const totalReferrals = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by IS NOT NULL').get().count || 0;
        return { totalReferrals };
    },
    getStats: (rate = 1600) => {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const allTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
        const completedTransactions = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'COMPLETED'").get().count;
        const volUSD_Raw = db.prepare("SELECT SUM(amount) as sum FROM transactions WHERE status = 'COMPLETED' AND currency = 'USD'").get().sum || 0;
        const volNGN_Raw = db.prepare("SELECT SUM(amount) as sum FROM transactions WHERE status = 'COMPLETED' AND currency = 'NGN'").get().sum || 0;
        const combinedVolumeUSD = volUSD_Raw + (volNGN_Raw / rate);
        const combinedVolumeNGN = volNGN_Raw + (volUSD_Raw * rate);
        const feeRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_fee'").get();
        const feePercent = feeRow ? parseFloat(feeRow.value) : 1;
        const earnedUSD = (combinedVolumeUSD * feePercent) / 100;
        const earnedNGN = (combinedVolumeNGN * feePercent) / 100;
        return {
            totalUsers,
            allTransactions,
            completedTransactions,
            totalVolumeUSD: combinedVolumeUSD,
            totalVolumeNGN: combinedVolumeNGN,
            totalEarnedUSD: earnedUSD,
            totalEarnedNGN: earnedNGN,
            platformFee: feePercent,
            currentRate: rate,
        };
    },
    getAdminTransactions: (limit = 50) => {
        return db.prepare(`
      SELECT t.*, u.username, u.full_name 
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC 
      LIMIT ?
    `).all(limit);
    },
    getSettings: () => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return settings;
    },
    updateSetting: (key, value) => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },
    getUserProcessingStats: (rate = 1600) => {
        const users = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.full_name,
        u.created_at,
        u.last_seen,
        u.tx_count
      FROM users u
      ORDER BY u.tx_count DESC, u.id ASC
    `).all();
        return users.map(u => {
            const txs = db.prepare("SELECT amount, currency FROM transactions WHERE user_id = ? AND status = 'COMPLETED'").all(u.id);
            let volUSD = 0;
            let volNGN = 0;
            txs.forEach(t => {
                if (t.currency === 'NGN')
                    volNGN += t.amount;
                else
                    volUSD += t.amount;
            });
            return {
                ...u,
                total_volume: volUSD + (volNGN / rate),
                total_volume_ngn: volNGN + (volUSD * rate)
            };
        }).sort((a, b) => b.total_volume - a.total_volume);
    },
    getDetailedReferralStats: () => {
        const referrers = db.prepare(`
      SELECT 
        u.id, u.username, u.full_name, u.referral_code, u.referral_count, 
        u.referral_balance, u.total_referral_earnings
      FROM users u
      WHERE u.referral_count > 0
      ORDER BY u.total_referral_earnings DESC
    `).all();
        return referrers.map(r => {
            const referrals = db.prepare(`
        SELECT id, username, full_name, total_volume, created_at
        FROM users
        WHERE referred_by = ?
        ORDER BY total_volume DESC
      `).all(r.id);
            return {
                ...r,
                referrals
            };
        });
    },
    getUserDetailStats: (userId, rate = 1600) => {
        const statsResult = db.prepare(`
      SELECT 
        COUNT(*) as total_tx,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as success_tx,
        SUM(CASE WHEN status IN ('FAILED', 'EXPIRED') THEN 1 ELSE 0 END) as failed_tx
      FROM transactions 
      WHERE user_id = ?
    `).get(userId);
        const txs = db.prepare("SELECT amount, currency FROM transactions WHERE user_id = ? AND status = 'COMPLETED'").all(userId);
        let volUSD = 0;
        let volNGN = 0;
        txs.forEach(t => {
            if (t.currency === 'NGN')
                volNGN += t.amount;
            else
                volUSD += t.amount;
        });
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        return {
            user,
            stats: {
                total: statsResult.total_tx || 0,
                success: statsResult.success_tx || 0,
                failed: statsResult.failed_tx || 0,
                volume: volUSD + (volNGN / rate),
                volume_ngn: volNGN + (volUSD * rate)
            }
        };
    },
    getTransactionDetails: (reference) => {
        return db.prepare(`
      SELECT 
        t.id, t.user_id, t.reference, t.type, t.asset, t.amount, t.currency, t.status, t.hash, t.created_at, t.updated_at, t.wallet_address,
        u.username, u.full_name, u.id as user_db_id
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.reference = ?
    `).get(reference);
    },
    getUserTransactions: (userId, limit = 20) => {
        return db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);
    },
};
//# sourceMappingURL=storage.js.map