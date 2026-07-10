"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const storage_1 = require("./storage");
const switch_1 = require("./switch");
const blockchain_1 = require("./blockchain");
const notification_1 = require("./notification");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../utils/logger"));
const dbPath = path_1.default.resolve(__dirname, '../../bitnova.db');
const db = new better_sqlite3_1.default(dbPath);
const startScheduler = () => {
    logger_1.default.info('⏳ Starting Transaction Recovery Scheduler (1min)...');
    node_cron_1.default.schedule('* * * * *', async () => {
        var _a, _b, _c, _d, _e, _f, _g;
        logger_1.default.info('🔄 Running scheduled recovery check...');
        try {
            const rows = db.prepare(`
                SELECT reference, status, created_at, type, user_id, asset, amount, wallet_address FROM transactions 
                WHERE status IN ('PENDING', 'AWAITING_DEPOSIT', 'PROCESSING', 'VERIFIED', 'SCHEDULED')
                AND created_at < datetime('now', '-1 minutes')
                AND created_at > datetime('now', '-24 hours')
            `).all();
            if (rows.length > 0) {
                logger_1.default.info(`Found ${rows.length} pending transactions to recover.`);
                for (const tx of rows) {
                    try {
                        const previousStatus = tx.status;
                        const status = await switch_1.switchService.getStatus(tx.reference);
                        if ((status.type === 'OFFRAMP' || tx.type === 'OFFRAMP') && status.status === 'AWAITING_DEPOSIT') {
                            const depositAddress = (_a = status.deposit) === null || _a === void 0 ? void 0 : _a.address;
                            if (depositAddress) {
                                logger_1.default.info(`Scanning blockchain for ${tx.reference} (${depositAddress})...`);
                                const hash = await blockchain_1.blockchainService.findIncomingTx(depositAddress);
                                if (hash) {
                                    logger_1.default.info(`Found hash ${hash} for ${tx.reference}, confirming...`);
                                    const result = await switch_1.switchService.confirmDeposit(tx.reference, hash);
                                    if (result) {
                                        const newStatus = result.status || 'PROCESSING';
                                        storage_1.storageService.updateTransactionStatus(tx.reference, newStatus, hash);
                                        logger_1.default.info(`✅ Auto-confirmed ${tx.reference}`);
                                        const extraData = {
                                            walletAddress: ((_b = status.destination) === null || _b === void 0 ? void 0 : _b.address) || ((_c = status.beneficiary) === null || _c === void 0 ? void 0 : _c.account_number) || tx.wallet_address,
                                            type: status.type || tx.type
                                        };
                                        await notification_1.notificationService.sendUpdate(tx.user_id, tx.reference, newStatus, tx.asset, tx.amount, hash, undefined, extraData);
                                    }
                                }
                            }
                        }
                        else if (status.status !== previousStatus) {
                            const txHash = status.hash || status.txHash || status.transactionHash || status.tx_hash || status.blockchain_tx_id || status.transaction_id;
                            storage_1.storageService.updateTransactionStatus(tx.reference, status.status, txHash);
                            logger_1.default.info(`Updated status for ${tx.reference} -> ${status.status} (Hash: ${txHash || 'None'})`);
                            const notifiableStatuses = ['RECEIVED', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'];
                            if (notifiableStatuses.includes(status.status)) {
                                const extraData = {
                                    destinationAmount: ((_d = status.destination) === null || _d === void 0 ? void 0 : _d.amount) || status.destinationAmount,
                                    destinationCurrency: ((_e = status.destination) === null || _e === void 0 ? void 0 : _e.currency) || status.destinationCurrency || 'NGN',
                                    rate: status.rate || status.exchangeRate,
                                    type: status.type || tx.type,
                                    walletAddress: ((_f = status.destination) === null || _f === void 0 ? void 0 : _f.address) || ((_g = status.beneficiary) === null || _g === void 0 ? void 0 : _g.account_number) || tx.wallet_address
                                };
                                await notification_1.notificationService.sendUpdate(tx.user_id, tx.reference, status.status, tx.asset, tx.amount, txHash || status.txHash || status.hash || status.transactionHash, undefined, extraData);
                            }
                        }
                    }
                    catch (e) {
                        logger_1.default.error(`❌ Failed to recover ${tx.reference}: ${e.message}`);
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error(`Scheduler Error: ${error.message}`);
        }
    });
};
exports.startScheduler = startScheduler;
//# sourceMappingURL=scheduler.js.map