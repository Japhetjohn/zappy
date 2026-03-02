import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../bitnova.db');
console.log(`🚀 Starting Volume Migration at ${dbPath}...`);
const db = new Database(dbPath);

const RATE = 1600;

function migrate() {
    try {
        db.transaction(() => {
            // 1. Fix OFFRAMP currencies: All OFFRAMP should be USD
            // (Wait, only if they are currently NGN but represent crypto sales)
            // Based on user feedback: "offramp in dollar".
            console.log('🔄 Fixing OFFRAMP currencies to USD...');
            const offrampFix = db.prepare("UPDATE transactions SET currency = 'USD' WHERE type = 'OFFRAMP' AND currency = 'NGN'").run();
            console.log(`✅ Fixed ${offrampFix.changes} offramp records.`);

            // 2. Safety: Fix ONRAMP currencies if they are USD but clearly NGN amounts
            // (e.g. > 1000)
            console.log('🔄 Checking for misplaced ONRAMP currencies...');
            const onrampFix = db.prepare("UPDATE transactions SET currency = 'NGN' WHERE type = 'ONRAMP' AND currency = 'USD' AND amount > 500").run();
            console.log(`✅ Fixed ${onrampFix.changes} onramp records.`);

            // 3. Recalculate User Volumes
            console.log('🔄 Recalculating all user volumes in USD...');
            const users = db.prepare('SELECT id FROM users').all() as any[];

            for (const user of users) {
                const txs = db.prepare("SELECT amount, currency FROM transactions WHERE user_id = ? AND status = 'COMPLETED'").all(user.id) as any[];
                let totalVolumeUSD = 0;

                for (const tx of txs) {
                    if (tx.currency === 'NGN') {
                        totalVolumeUSD += tx.amount / RATE;
                    } else {
                        totalVolumeUSD += tx.amount;
                    }
                }

                db.prepare('UPDATE users SET total_volume = ? WHERE id = ?').run(totalVolumeUSD, user.id);
            }
            console.log(`✅ Recalculated volume for ${users.length} users.`);
        })();

        console.log('✨ Migration completed successfully!');
    } catch (error: any) {
        console.error(`❌ Migration failed: ${error.message}`);
        process.exit(1);
    }
}

migrate();
