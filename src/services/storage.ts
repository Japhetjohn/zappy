import Database from 'better-sqlite3';
import path from 'path';
import { Beneficiary } from '../types';

console.log('Initializing Storage Service...');
const dbPath = path.resolve(__dirname, '../../bitnova.db');
console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath);
console.log('Database connected.');

// 🚀 TURBOCHARGE SQLITE FOR SCALE (Handles 50k+ users/day easily)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 30000000000'); // 30GB mmap (or max available)
db.pragma('page_size = 4096');
db.pragma('cache_size = -2000'); // 2MB cache

// Initialize tables with proper indexing for 20k+ users/day
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
} catch (e) { }

// Safe migrations for existing databases


try {
  db.prepare('ALTER TABLE users ADD COLUMN referral_balance REAL DEFAULT 0').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE users ADD COLUMN total_referral_earnings REAL DEFAULT 0').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE users ADD COLUMN referred_by INTEGER').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
} catch (e) { }

try {
  db.prepare('ALTER TABLE transactions ADD COLUMN hash TEXT').run();
} catch (e) { }

// Settings Table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Initialize default fee settings if not exists
const defaultSettings = [
  { key: 'platform_fee', value: '1' },
];

for (const setting of defaultSettings) {
  try {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(setting.key, setting.value);
  } catch (e) { }
}

// Migration: reduce platform_fee from old default 4.5 to 1 if still present
try {
  const feeRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_fee'").get() as any;
  if (feeRow && (feeRow.value === '4.5' || feeRow.value === '4.50')) {
    db.prepare("UPDATE settings SET value = '1' WHERE key = 'platform_fee'").run();
    console.log('[STORAGE] Migrated platform_fee from 4.5 to 1');
  }
} catch (e) { }

// Backfill referral codes for existing users who don't have one
try {
  const usersWithoutCode = db.prepare("SELECT id FROM users WHERE referral_code IS NULL").all() as any[];
  for (const user of usersWithoutCode) {
    const code = generateUniqueReferralCode(user.id);
    db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, user.id);
  }
  if (usersWithoutCode.length > 0) {
    console.log(`[STORAGE] Backfilled ${usersWithoutCode.length} referral codes`);
  }
} catch (e) { }

// Generate a unique 6-character alphanumeric referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUniqueReferralCode(userId: number): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const existing = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
    if (!existing) return code;
  }
  // Fallback to user-id-based code if collisions persist
  return `REF${userId}`;
}

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
    // Check for duplicate
    const check = db.prepare('SELECT id FROM beneficiaries WHERE user_id = ? AND bank_code = ? AND account_number = ?');
    const existing = check.get(beneficiary.userId, beneficiary.bankCode, beneficiary.accountNumber);
    if (existing) {
      console.log(`[STORAGE] Duplicate beneficiary found for user ${beneficiary.userId}, skipping save.`);
      return (existing as any).id;
    }

    const stmt = db.prepare(`
      INSERT INTO beneficiaries (user_id, holder_name, bank_code, account_number, bank_name, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
      const result = stmt.run(
        beneficiary.userId,
        beneficiary.holderName,
        beneficiary.bankCode,
        beneficiary.accountNumber,
        beneficiary.bankName,
        beneficiary.walletAddress || null
      );
      console.log(`[STORAGE] Saved beneficiary for user ${beneficiary.userId}, ID: ${result.lastInsertRowid}`);
      return result.lastInsertRowid;
    } catch (e: any) {
      console.error(`[STORAGE] Failed to save beneficiary: ${e.message}`);
      throw e;
    }
  },

  getTransactionHistory: (userId: number, limit: number = 10, offset: number = 0, statusFilters?: string[]) => {
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (statusFilters && statusFilters.length > 0) {
      const placeholders = statusFilters.map(() => '?').join(',');
      sql += ` AND status IN (${placeholders})`;
      params.push(...statusFilters);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(sql);
    return stmt.all(...params) as any[];
  },

  addTransaction: (data: {
    userId: number;
    reference: string;
    type: 'ONRAMP' | 'OFFRAMP';
    asset: string;
    amount: number;
    currency?: string;
    status?: string;
    walletAddress?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, reference, type, asset, amount, currency, status, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.userId,
      data.reference,
      data.type,
      data.asset,
      data.amount,
      data.currency || 'USD',
      data.status || 'PENDING',
      data.walletAddress || null
    );

    // Increment user's tx count (on a transaction basis)
    db.prepare('UPDATE users SET tx_count = tx_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(data.userId);

    return result;
  },



  updateTransactionStatus: (reference: string, status: string, hash?: string) => {
    let sql = 'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (hash) {
      sql += ', hash = ?';
      params.push(hash);
    }

    sql += ' WHERE reference = ?';
    params.push(reference);

    const stmt = db.prepare(sql);
    const result = stmt.run(...params);

    // If completed, update user total volume (idempotent)
    if (status === 'COMPLETED') {
      const tx = db.prepare('SELECT user_id, amount, currency, type FROM transactions WHERE reference = ?').get(reference) as any;
      if (tx) {
        let volumeUSD = tx.amount;
        if (tx.currency === 'NGN') {
          volumeUSD = tx.amount / 1600; // Standardize user volume in USD (approximate rate)
        }

        db.transaction(() => {
          db.prepare('UPDATE users SET total_volume = total_volume + ? WHERE id = ?')
            .run(volumeUSD, tx.user_id);
            
          // Add 0.1% referral reward logic (IN USD!)
          const user = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(tx.user_id) as any;
          if (user && user.referred_by) {
            const rewardAmountUSD = volumeUSD * 0.001; // 0.1% of USD volume
            if (rewardAmountUSD > 0) {
                db.prepare('UPDATE users SET referral_balance = referral_balance + ?, total_referral_earnings = total_referral_earnings + ? WHERE id = ?')
                  .run(rewardAmountUSD, rewardAmountUSD, user.referred_by);
                  
                // Notify the referrer asynchronously
                setTimeout(() => {
                    try {
                        const { notificationService } = require('./notification');
                        notificationService.sendReferralCreditNotification(user.referred_by, rewardAmountUSD);
                    } catch (e) {}
                }, 100);
            }
          }
        })();
      }
    }
    return result;
  },

  getTransaction: (reference: string) => {
    const stmt = db.prepare('SELECT * FROM transactions WHERE reference = ?');
    return stmt.get(reference) as any;
  },

  // Expanded user tracking for Velcro scale
  // Returns true if a new user was created, false if existing user was updated
  upsertUser: (id: number, username: string, fullName?: string): boolean => {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as any;

    if (!existing) {
      // New user: generate referral code
      const referralCode = generateUniqueReferralCode(id);
      const stmt = db.prepare(`
        INSERT INTO users (id, username, full_name, referral_code, last_seen)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(id, username, fullName || null, referralCode);
      return true;
    } else {
      // Existing user: just update username/full_name/last_seen, never overwrite referrer or code
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







  getUserByReferralCode: (code: string) => {
    return db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code) as any;
  },

  getUserReferralStats: (userId: number) => {
    const user = db.prepare('SELECT referral_code, referral_count, referral_balance, total_referral_earnings FROM users WHERE id = ?').get(userId) as any;
    return {
      code: user?.referral_code || null,
      referralCount: user?.referral_count || 0,
      balance: user?.referral_balance || 0,
      totalEarned: user?.total_referral_earnings || 0,
    };
  },

  requestWithdrawal: (userId: number, amount: number, address: string, chain: string) => {
    return db.transaction(() => {
       const user = db.prepare('SELECT referral_balance FROM users WHERE id = ?').get(userId) as any;
       if (!user || user.referral_balance < amount) throw new Error('Insufficient referral balance');
       db.prepare('UPDATE users SET referral_balance = referral_balance - ? WHERE id = ?').run(amount, userId);
       const result = db.prepare('INSERT INTO withdrawals (user_id, amount, wallet_address, chain, status) VALUES (?, ?, ?, ?, ?)').run(userId, amount, address, chain, 'PENDING');
       return result.lastInsertRowid;
    })();
  },

  recordReferral: (referredUserId: number, referrerUserId: number): boolean => {
    // Only reward if referred user is new, not self, and not already referred
    const referred = db.prepare('SELECT id, referred_by FROM users WHERE id = ?').get(referredUserId) as any;
    if (!referred || referred.referred_by) return false;
    if (referredUserId === referrerUserId) return false;

    return db.transaction(() => {
      db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrerUserId, referredUserId);
      const result = db.prepare('UPDATE users SET referral_count = referral_count + 1 WHERE id = ?').run(referrerUserId);
      return result.changes > 0;
    })();
  },

  getReferralStats: () => {
    const totalReferrals = (db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by IS NOT NULL').get() as any).count || 0;
    return { totalReferrals };
  },







  // 📊 PLATFORM ANALYTICS HANDLER
  getStats: (rate: number = 1600) => {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const allTransactions = (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any).count;
    const completedTransactions = (db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'COMPLETED'").get() as any).count;

    // Calculate raw volumes
    const volUSD_Raw = (db.prepare("SELECT SUM(amount) as sum FROM transactions WHERE status = 'COMPLETED' AND currency = 'USD'").get() as any).sum || 0;
    const volNGN_Raw = (db.prepare("SELECT SUM(amount) as sum FROM transactions WHERE status = 'COMPLETED' AND currency = 'NGN'").get() as any).sum || 0;

    // Combined Totals (Summing both currencies)
    const combinedVolumeUSD = volUSD_Raw + (volNGN_Raw / rate);
    const combinedVolumeNGN = volNGN_Raw + (volUSD_Raw * rate);

    // Profit based on dynamic fee
    const feeRow = db.prepare("SELECT value FROM settings WHERE key = 'platform_fee'").get() as any;
    const feePercent = feeRow ? parseFloat(feeRow.value) : 1;

    const earnedUSD = (combinedVolumeUSD * feePercent) / 100;
    const earnedNGN = (combinedVolumeNGN * feePercent) / 100;

    return {
      totalUsers,
      allTransactions,
      completedTransactions,
      // Global Totals
      totalVolumeUSD: combinedVolumeUSD,
      totalVolumeNGN: combinedVolumeNGN,
      totalEarnedUSD: earnedUSD,
      totalEarnedNGN: earnedNGN,
      platformFee: feePercent,
      currentRate: rate,
    };
  },

  getAdminTransactions: (limit: number = 50) => {
    return db.prepare(`
      SELECT t.*, u.username, u.full_name 
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC 
      LIMIT ?
    `).all(limit) as any[];
  },

  getSettings: () => {
    const rows = db.prepare('SELECT * FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    rows.forEach(r => settings[r.key] = r.value);
    return settings;
  },

  updateSetting: (key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  },

  getUserProcessingStats: (rate: number = 1600) => {
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
    `).all() as any[];

    // Calculate currency-aware volume for each user manually to support dynamic combined total
    return users.map(u => {
      const txs = db.prepare("SELECT amount, currency FROM transactions WHERE user_id = ? AND status = 'COMPLETED'").all(u.id) as any[];
      let volUSD = 0;
      let volNGN = 0;
      txs.forEach(t => {
        if (t.currency === 'NGN') volNGN += t.amount;
        else volUSD += t.amount;
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
    `).all() as any[];

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

  getUserDetailStats: (userId: number, rate: number = 1600) => {
    const statsResult = db.prepare(`
      SELECT 
        COUNT(*) as total_tx,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as success_tx,
        SUM(CASE WHEN status IN ('FAILED', 'EXPIRED') THEN 1 ELSE 0 END) as failed_tx
      FROM transactions 
      WHERE user_id = ?
    `).get(userId) as any;

    const txs = db.prepare("SELECT amount, currency FROM transactions WHERE user_id = ? AND status = 'COMPLETED'").all(userId) as any[];
    let volUSD = 0;
    let volNGN = 0;
    txs.forEach(t => {
      if (t.currency === 'NGN') volNGN += t.amount;
      else volUSD += t.amount;
    });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

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
  }
  ,

  getTransactionDetails: (reference: string) => {
    return db.prepare(`
      SELECT 
        t.id, t.user_id, t.reference, t.type, t.asset, t.amount, t.currency, t.status, t.hash, t.created_at, t.updated_at, t.wallet_address,
        u.username, u.full_name, u.id as user_db_id
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.reference = ?
    `).get(reference) as any;
  },

  getUserTransactions: (userId: number, limit: number = 20) => {
    return db.prepare(`
      SELECT * FROM transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as any[];
  },
};
