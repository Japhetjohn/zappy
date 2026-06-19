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
    points INTEGER DEFAULT 0,
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
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    points_discount_pct REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(reference);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
`);
try {
    db.prepare('ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0').run();
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
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN points_earned INTEGER DEFAULT 0').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN points_redeemed INTEGER DEFAULT 0').run();
}
catch (e) { }
try {
    db.prepare('ALTER TABLE transactions ADD COLUMN points_discount_pct REAL DEFAULT 0').run();
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
    { key: 'points_per_tx', value: '1' },
    { key: 'points_value_pct', value: '0.1' },
    { key: 'max_points_per_tx', value: '5' },
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
      INSERT INTO transactions (user_id, reference, type, asset, amount, currency, status, points_redeemed, points_discount_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.userId, data.reference, data.type, data.asset, data.amount, data.currency || 'USD', data.status || 'PENDING', data.pointsRedeemed || 0, data.pointsDiscountPct || 0);
        db.prepare('UPDATE users SET tx_count = tx_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(data.userId);
        return result;
    },
    addTransactionAndRedeemPoints: (data) => {
        return db.transaction(() => {
            const stmt = db.prepare(`
        INSERT INTO transactions (user_id, reference, type, asset, amount, currency, status, points_redeemed, points_discount_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const result = stmt.run(data.userId, data.reference, data.type, data.asset, data.amount, data.currency || 'USD', data.status || 'PENDING', data.pointsRedeemed || 0, data.pointsDiscountPct || 0);
            db.prepare('UPDATE users SET tx_count = tx_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(data.userId);
            if (data.pointsRedeemed && data.pointsRedeemed > 0) {
                const redeemResult = db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?')
                    .run(data.pointsRedeemed, data.userId, data.pointsRedeemed);
                if (redeemResult.changes === 0) {
                    throw new Error(`Insufficient points balance to redeem ${data.pointsRedeemed} points`);
                }
            }
            return result;
        })();
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
            const tx = db.prepare('SELECT user_id, amount, currency, points_earned, type FROM transactions WHERE reference = ?').get(reference);
            if (tx && tx.points_earned === 0) {
                let volumeUSD = tx.amount;
                if (tx.currency === 'NGN') {
                    volumeUSD = tx.amount / 1600;
                }
                const pointsPerTx = exports.storageService.getPointSettings().perTx;
                db.transaction(() => {
                    db.prepare('UPDATE users SET total_volume = total_volume + ?, points = points + ? WHERE id = ?')
                        .run(volumeUSD, pointsPerTx, tx.user_id);
                    db.prepare('UPDATE transactions SET points_earned = ? WHERE reference = ?')
                        .run(pointsPerTx, reference);
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
    getUserPoints: (userId) => {
        const row = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
        return row ? row.points || 0 : 0;
    },
    addPoints: (userId, amount) => {
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(amount, userId);
    },
    redeemPoints: (userId, amount) => {
        const result = db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').run(amount, userId, amount);
        return result.changes > 0;
    },
    getUserByReferralCode: (code) => {
        return db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code);
    },
    getUserReferralStats: (userId) => {
        const user = db.prepare('SELECT referral_code, referral_count FROM users WHERE id = ?').get(userId);
        return {
            code: (user === null || user === void 0 ? void 0 : user.referral_code) || null,
            referralCount: (user === null || user === void 0 ? void 0 : user.referral_count) || 0,
            referralPointsEarned: ((user === null || user === void 0 ? void 0 : user.referral_count) || 0) * 5,
        };
    },
    recordReferral: (referredUserId, referrerUserId) => {
        const referred = db.prepare('SELECT id, referred_by FROM users WHERE id = ?').get(referredUserId);
        if (!referred || referred.referred_by)
            return false;
        if (referredUserId === referrerUserId)
            return false;
        return db.transaction(() => {
            db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrerUserId, referredUserId);
            const result = db.prepare('UPDATE users SET referral_count = referral_count + 1, points = points + 5 WHERE id = ?').run(referrerUserId);
            return result.changes > 0;
        })();
    },
    getReferralStats: () => {
        const totalReferrals = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by IS NOT NULL').get().count || 0;
        const totalReferralPoints = totalReferrals * 5;
        return { totalReferrals, totalReferralPoints };
    },
    getPointSettings: () => {
        const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('points_per_tx', 'points_value_pct', 'max_points_per_tx')").all();
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return {
            perTx: parseFloat(settings.points_per_tx) || 1,
            valuePct: parseFloat(settings.points_value_pct) || 0.1,
            maxPerTx: parseFloat(settings.max_points_per_tx) || 5,
        };
    },
    updatePointSettings: (settings) => {
        db.transaction(() => {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('points_per_tx', settings.perTx.toString());
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('points_value_pct', settings.valuePct.toString());
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('max_points_per_tx', settings.maxPerTx.toString());
        })();
    },
    getPointStats: () => {
        const totalAwarded = db.prepare('SELECT SUM(points_earned) as sum FROM transactions').get().sum || 0;
        const totalRedeemed = db.prepare('SELECT SUM(points_redeemed) as sum FROM transactions').get().sum || 0;
        const usersWithPoints = db.prepare('SELECT COUNT(*) as count FROM users WHERE points > 0').get().count || 0;
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count || 0;
        return {
            totalAwarded,
            totalRedeemed,
            usersWithPoints,
            averagePoints: totalUsers > 0 ? (totalAwarded - totalRedeemed) / totalUsers : 0,
        };
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
        const pointStats = exports.storageService.getPointStats();
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
            points: pointStats,
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
        u.tx_count,
        u.points
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
    getUserDetailStats: (userId, rate = 1600) => {
        const statsResult = db.prepare(`
      SELECT 
        COUNT(*) as total_tx,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as success_tx,
        SUM(CASE WHEN status IN ('FAILED', 'EXPIRED') THEN 1 ELSE 0 END) as failed_tx,
        SUM(points_earned) as points_earned,
        SUM(points_redeemed) as points_redeemed
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
                volume_ngn: volNGN + (volUSD * rate),
                pointsEarned: statsResult.points_earned || 0,
                pointsRedeemed: statsResult.points_redeemed || 0,
            }
        };
    },
    getTransactionDetails: (reference) => {
        return db.prepare(`
      SELECT 
        t.id, t.user_id, t.reference, t.type, t.asset, t.amount, t.currency, t.status, t.hash, t.created_at, t.updated_at,
        t.points_earned, t.points_redeemed, t.points_discount_pct,
        u.username, u.full_name, u.id as user_db_id, u.points as user_points
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