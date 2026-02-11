
import cron from 'node-cron';
import { storageService } from './storage';
import { switchService } from './switch';
import { blockchainService } from './blockchain';
import { config } from '../config';
import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

// Direct DB access for complex queries
const dbPath = path.resolve(__dirname, '../../bitnova.db');
const db = new Database(dbPath);

export const startScheduler = () => {
    logger.info('⏳ Starting Transaction Recovery Scheduler...');

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        logger.info('🔄 Running scheduled recovery check...');
        try {
            // Find PENDING transactions
            const rows = db.prepare(`
                SELECT reference, created_at, type FROM transactions 
                WHERE status IN ('PENDING', 'AWAITING_DEPOSIT')
                AND created_at < datetime('now', '-5 minutes')
                AND created_at > datetime('now', '-24 hours')
            `).all() as any[];

            if (rows.length > 0) {
                logger.info(`Found ${rows.length} pending transactions to recover.`);
                for (const tx of rows) {
                    try {
                        // 1. Get latest status from Switch
                        const status = await switchService.getStatus(tx.reference);

                        // 2. If it's OFFRAMP and AWAITING_DEPOSIT, we need to check blockchain
                        if ((status.type === 'OFFRAMP' || tx.type === 'OFFRAMP') && status.status === 'AWAITING_DEPOSIT') {
                            const depositAddress = status.deposit?.address;
                            if (depositAddress) {
                                logger.info(`Scanning blockchain for ${tx.reference} (${depositAddress})...`);
                                const hash = await blockchainService.findIncomingTx(depositAddress);

                                if (hash) {
                                    logger.info(`Found hash ${hash} for ${tx.reference}, confirming...`);
                                    const result = await switchService.confirmDeposit(tx.reference, hash);
                                    if (result) {
                                        storageService.updateTransactionStatus(tx.reference, result.status || 'PROCESSING', hash);
                                        logger.info(`✅ Auto-confirmed ${tx.reference}`);
                                    }
                                } else {
                                    logger.info(`No incoming tx found for ${tx.reference} yet.`);
                                }
                            }
                        }
                        // 3. If just a status update (e.g. Onramp confirmed by bank)
                        else if (status.status !== 'PENDING' && status.status !== 'AWAITING_DEPOSIT') {
                            storageService.updateTransactionStatus(tx.reference, status.status);
                            logger.info(`Updated status for ${tx.reference} -> ${status.status}`);
                        }
                    } catch (e: any) {
                        logger.error(`❌ Failed to recover ${tx.reference}: ${e.message}`);
                    }
                }
            }
        } catch (error: any) {
            logger.error(`Scheduler Error: ${error.message}`);
        }
    });
};
