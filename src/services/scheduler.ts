
import cron from 'node-cron';
import { storageService } from './storage';
import { switchService } from './switch';
import { blockchainService } from './blockchain';
import { notificationService } from './notification';
import { config } from '../config';
import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

// Direct DB access for complex queries
const dbPath = path.resolve(__dirname, '../../bitnova.db');
const db = new Database(dbPath);

export const startScheduler = () => {
    logger.info('⏳ Starting Transaction Recovery Scheduler (1min)...');

    // Run every 1 minute
    cron.schedule('* * * * *', async () => {
        logger.info('🔄 Running scheduled recovery check...');
        try {
            // Find PENDING transactions
            const rows = db.prepare(`
                SELECT reference, status, created_at, type, user_id, asset, amount FROM transactions 
                WHERE status IN ('PENDING', 'AWAITING_DEPOSIT', 'PROCESSING', 'VERIFIED', 'SCHEDULED')
                AND created_at < datetime('now', '-1 minutes')
                AND created_at > datetime('now', '-24 hours')
            `).all() as any[];

            if (rows.length > 0) {
                logger.info(`Found ${rows.length} pending transactions to recover.`);
                for (const tx of rows) {
                    try {
                        const previousStatus = tx.status;
                        const status = await switchService.getStatus(tx.reference);

                        // 1. If it's OFFRAMP and AWAITING_DEPOSIT, we need to check blockchain
                        if ((status.type === 'OFFRAMP' || tx.type === 'OFFRAMP') && status.status === 'AWAITING_DEPOSIT') {
                            const depositAddress = status.deposit?.address;
                            if (depositAddress) {
                                logger.info(`Scanning blockchain for ${tx.reference} (${depositAddress})...`);
                                const hash = await blockchainService.findIncomingTx(depositAddress);

                                if (hash) {
                                    logger.info(`Found hash ${hash} for ${tx.reference}, confirming...`);
                                    const result = await switchService.confirmDeposit(tx.reference, hash);
                                    if (result) {
                                        const newStatus = result.status || 'PROCESSING';
                                        storageService.updateTransactionStatus(tx.reference, newStatus, hash);
                                        logger.info(`✅ Auto-confirmed ${tx.reference}`);

                                        // Notify user about detection
                                        await notificationService.sendUpdate(tx.user_id, tx.reference, newStatus, tx.asset, tx.amount, hash);
                                    }
                                }
                            }
                        }
                        // 2. If status changed, update and notify
                        else if (status.status !== previousStatus) {
                            const txHash = status.hash || status.txHash || status.transactionHash || status.tx_hash || status.blockchain_tx_id || status.transaction_id;
                            storageService.updateTransactionStatus(tx.reference, status.status, txHash);
                            logger.info(`Updated status for ${tx.reference} -> ${status.status} (Hash: ${txHash || 'None'})`);

                            // Notify on all meaningful status changes so user stays informed
                            const notifiableStatuses = ['RECEIVED', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'];
                            if (notifiableStatuses.includes(status.status)) {
                                // Extract extra data for rich notifications
                                const extraData = {
                                    destinationAmount: status.destination?.amount || status.destinationAmount,
                                    destinationCurrency: status.destination?.currency || status.destinationCurrency || 'NGN',
                                    rate: status.rate || status.exchangeRate,
                                    type: status.type || tx.type
                                };

                                await notificationService.sendUpdate(
                                    tx.user_id,
                                    tx.reference,
                                    status.status,
                                    tx.asset,
                                    tx.amount,
                                    txHash || status.txHash || status.hash || status.transactionHash,
                                    undefined,
                                    extraData
                                );
                            }
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
