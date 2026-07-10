"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const bot_1 = require("../bot");
const storage_1 = require("../services/storage");
const switch_1 = require("../services/switch");
const notification_1 = require("../services/notification");
const blockchain_1 = require("../services/blockchain");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.status(200).send('Velcro Bot Server is Running ⚡️');
});
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${config_1.config.adminPassword}`) {
        logger_1.default.warn(`Unauthorized admin access attempt from ${req.ip}`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
};
app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
        const rates = await switch_1.switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;
        const stats = storage_1.storageService.getStats(rate);
        try {
            const fees = await switch_1.switchService.getDeveloperFees();
            stats.developerFees = fees;
        }
        catch (e) {
            logger_1.default.warn(`Failed to fetch developer fees for stats: ${e.message}`);
            stats.developerFees = { amount: 0, currency: 'USDC' };
        }
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/transactions', adminAuth, (req, res) => {
    try {
        const txs = storage_1.storageService.getAdminTransactions();
        res.json(txs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/transactions/:reference', adminAuth, (req, res) => {
    try {
        const reference = req.params.reference;
        const tx = storage_1.storageService.getTransactionDetails(reference);
        if (!tx)
            return res.status(404).json({ error: 'Transaction not found' });
        return res.json(tx);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/transactions/:reference/confirm', adminAuth, async (req, res) => {
    var _a, _b, _c, _d, _e;
    try {
        const reference = req.params.reference;
        const tx = storage_1.storageService.getTransaction(reference);
        if (!tx)
            return res.status(404).json({ error: 'Transaction not found' });
        logger_1.default.info(`🚨 Admin Auto-Confirm triggered for ${reference}`);
        let hashToUse = req.body.hash;
        try {
            const status = await switch_1.switchService.getStatus(reference);
            logger_1.default.info(`[AutoConfirm] Switch Status: ${status.status}, Hash: ${status.hash || 'None'}`);
            if (['COMPLETED', 'VERIFIED', 'PROCESSING'].includes(status.status)) {
                const finalHash = status.hash || status.txHash || status.transactionHash || hashToUse || tx.hash;
                storage_1.storageService.updateTransactionStatus(reference, status.status, finalHash);
                if (status.status === 'COMPLETED') {
                    await notification_1.notificationService.sendUpdate(tx.user_id, reference, 'COMPLETED', tx.asset, tx.amount, finalHash, undefined, {
                        destinationAmount: tx.destination_amount || ((_a = status.destination) === null || _a === void 0 ? void 0 : _a.amount),
                        destinationCurrency: tx.destination_currency || ((_b = status.destination) === null || _b === void 0 ? void 0 : _b.currency),
                        walletAddress: tx.wallet_address || ((_c = status.destination) === null || _c === void 0 ? void 0 : _c.address),
                        type: tx.type
                    });
                }
                return res.json({ success: true, message: `Synced status: ${status.status}`, data: status });
            }
            if (tx.type === 'OFFRAMP' && (status.status === 'AWAITING_DEPOSIT' || tx.status === 'AWAITING_DEPOSIT')) {
                if (!hashToUse && !status.hash) {
                    logger_1.default.info(`[AutoConfirm] Scanning blockchain for incoming tx to ${(_d = status.deposit) === null || _d === void 0 ? void 0 : _d.address}...`);
                    if ((_e = status.deposit) === null || _e === void 0 ? void 0 : _e.address) {
                        const foundHash = await blockchain_1.blockchainService.findIncomingTx(status.deposit.address);
                        if (foundHash) {
                            logger_1.default.info(`[AutoConfirm] Found blockchain hash: ${foundHash}`);
                            hashToUse = foundHash;
                        }
                    }
                }
            }
        }
        catch (e) {
            logger_1.default.warn(`[AutoConfirm] Status check failed: ${e.message}`);
        }
        if (!hashToUse && tx.hash)
            hashToUse = tx.hash;
        const result = await switch_1.switchService.confirmDeposit(reference, hashToUse);
        const newStatus = result.status || 'PROCESSING';
        storage_1.storageService.updateTransactionStatus(reference, newStatus, hashToUse);
        await notification_1.notificationService.sendUpdate(tx.user_id, reference, newStatus, tx.asset, tx.amount, hashToUse, undefined, {
            walletAddress: tx.wallet_address,
            type: tx.type
        });
        return res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.default.error(`Manual confirmation failed for ${req.params.reference}: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/transactions/:reference/cancel', adminAuth, async (req, res) => {
    try {
        const reference = req.params.reference;
        const tx = storage_1.storageService.getTransaction(reference);
        if (!tx)
            return res.status(404).json({ error: 'Transaction not found' });
        storage_1.storageService.updateTransactionStatus(reference, 'CANCELLED');
        await notification_1.notificationService.sendUpdate(tx.user_id, reference, 'CANCELLED', tx.asset, tx.amount, undefined, 'Transaction cancelled by admin.');
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/users', adminAuth, async (req, res) => {
    try {
        const rates = await switch_1.switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;
        const users = storage_1.storageService.getUserProcessingStats(rate);
        res.json(users);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/users/:id/details', adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const rates = await switch_1.switchService.getRates().catch(() => ({ buy: 1500, sell: 1500 }));
        const rate = (rates.buy + rates.sell) / 2 || 1500;
        const details = storage_1.storageService.getUserDetailStats(userId, rate);
        res.json(details);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/users/:id/transactions', adminAuth, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const txs = storage_1.storageService.getUserTransactions(userId);
        res.json(txs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/withdraw', adminAuth, async (req, res) => {
    try {
        const SOLANA_WALLET = config_1.config.developerWallet || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV';
        const asset = req.body.asset || 'solana:usdc';
        const fees = await switch_1.switchService.getDeveloperFees();
        if (!fees.amount || fees.amount <= 0) {
            return res.status(400).json({ error: 'No fees available to withdraw', available: fees });
        }
        logger_1.default.info(`💸 Admin initiated fee withdrawal: ${fees.amount} ${fees.currency} -> ${SOLANA_WALLET} as ${asset}`);
        const result = await switch_1.switchService.withdrawDeveloperFees(asset, SOLANA_WALLET);
        logger_1.default.info(`✅ Fee withdrawal successful: ${JSON.stringify(result)}`);
        return res.json({
            success: true,
            message: 'Withdrawal initiated successfully',
            data: {
                ...result,
                wallet: SOLANA_WALLET,
                asset,
            }
        });
    }
    catch (e) {
        logger_1.default.error(`❌ Fee withdrawal failed: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/settings', adminAuth, (req, res) => {
    try {
        const settings = storage_1.storageService.getSettings();
        const filtered = {};
        const keysToKeep = ['platform_fee'];
        keysToKeep.forEach(k => {
            if (settings[k] !== undefined)
                filtered[k] = settings[k];
        });
        res.json(filtered);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
const ALLOWED_SETTINGS_KEYS = [
    'platform_fee'
];
app.get('/api/admin/referrals/detailed', adminAuth, (req, res) => {
    try {
        const stats = storage_1.storageService.getDetailedReferralStats();
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/settings', adminAuth, (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined)
            throw new Error('Key and value required');
        if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
            return res.status(400).json({ error: 'Setting key not allowed', allowed: ALLOWED_SETTINGS_KEYS });
        }
        if (key === 'platform_fee') {
            const fee = parseFloat(value);
            if (isNaN(fee) || fee < 0 || fee > 50) {
                return res.status(400).json({ error: 'platform_fee must be between 0 and 50' });
            }
        }
        storage_1.storageService.updateSetting(key, value.toString());
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/referrals', adminAuth, (req, res) => {
    try {
        const stats = storage_1.storageService.getReferralStats();
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/withdrawals', adminAuth, (req, res) => {
    try {
        const { db } = require('../services/storage');
        const rows = db.prepare('SELECT w.*, u.username, u.name FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC').all();
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/withdrawals/:id/approve', adminAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { db } = require('../services/storage');
        const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
        if (!withdrawal || withdrawal.status !== 'PENDING')
            return res.status(400).json({ error: 'Invalid or already processed' });
        db.prepare('UPDATE withdrawals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('APPROVED', id);
        try {
            const msg = `
✅ <b>Withdrawal Approved!</b>

Your withdrawal request of <b>$${withdrawal.amount.toLocaleString()}</b> has been cleared and sent to your wallet:
<code>${withdrawal.wallet_address}</code> (${withdrawal.chain})
            `;
            await bot_1.bot.telegram.sendMessage(withdrawal.user_id, msg, { parse_mode: 'HTML' });
        }
        catch (e) { }
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
app.post('/api/admin/withdrawals/:id/reject', adminAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { db } = require('../services/storage');
        const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
        if (!withdrawal || withdrawal.status !== 'PENDING')
            return res.status(400).json({ error: 'Invalid or already processed' });
        db.transaction(() => {
            db.prepare('UPDATE withdrawals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('REJECTED', id);
            db.prepare('UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?').run(withdrawal.amount, withdrawal.user_id);
        })();
        try {
            const msg = `
❌ <b>Withdrawal Rejected</b>

Your withdrawal request of <b>$${withdrawal.amount.toLocaleString()}</b> was rejected by the admin.
The amount has been refunded back to your referral balance.
            `;
            await bot_1.bot.telegram.sendMessage(withdrawal.user_id, msg, { parse_mode: 'HTML' });
        }
        catch (e) { }
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
const broadcastJobs = new Map();
function generateBroadcastJobId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
    try {
        const { message, parseMode } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const trimmedMessage = message.trim();
        if (trimmedMessage.length > 4096) {
            return res.status(400).json({ error: 'Message exceeds Telegram max length of 4096 characters' });
        }
        const allowedParseModes = ['HTML', 'Markdown', 'MarkdownV2', 'none'];
        const mode = parseMode && typeof parseMode === 'string' ? parseMode.trim() : 'none';
        if (!allowedParseModes.includes(mode)) {
            return res.status(400).json({ error: 'Invalid parseMode. Use HTML, Markdown, MarkdownV2, or none' });
        }
        const userRows = storage_1.storageService.getAllUserIds();
        const userIds = userRows.map((u) => u.id);
        const job = {
            id: generateBroadcastJobId(),
            status: 'running',
            total: userIds.length,
            sent: 0,
            failed: 0,
            errors: [],
            createdAt: new Date(),
        };
        broadcastJobs.set(job.id, job);
        (async () => {
            for (const userId of userIds) {
                try {
                    const extra = {};
                    if (mode !== 'none') {
                        extra.parse_mode = mode;
                    }
                    await bot_1.bot.telegram.sendMessage(userId, trimmedMessage, Object.keys(extra).length > 0 ? extra : undefined);
                    job.sent++;
                }
                catch (e) {
                    job.failed++;
                    const errMsg = e.message || 'Unknown error';
                    if (job.errors.length < 30) {
                        job.errors.push(`User ${userId}: ${errMsg}`);
                    }
                    logger_1.default.warn(`Broadcast failed for user ${userId}: ${errMsg}`);
                }
                await new Promise(resolve => setTimeout(resolve, 60));
            }
            job.status = 'completed';
            job.finishedAt = new Date();
            logger_1.default.info(`📢 Broadcast job ${job.id} completed: ${job.sent} sent, ${job.failed} failed`);
        })();
        return res.json({
            success: true,
            jobId: job.id,
            total: job.total,
            status: job.status,
            message: `Broadcast queued for ${job.total} users`,
        });
    }
    catch (e) {
        logger_1.default.error(`Broadcast endpoint error: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});
app.get('/api/admin/broadcast/:id', adminAuth, (req, res) => {
    const job = broadcastJobs.get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Broadcast job not found' });
    return res.json(job);
});
const path_1 = __importDefault(require("path"));
const publicPath = path_1.default.resolve(process.cwd(), 'public');
logger_1.default.info(`🚨 SERVING STATIC FROM: ${publicPath}`);
app.use('/admin', express_1.default.static(path_1.default.join(publicPath, 'admin')));
app.get(['/admin', '/admin/*'], (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'admin/index.html'));
});
app.post('/webhook', async (req, res) => {
    var _a, _b, _c, _d;
    const payload = req.body;
    logger_1.default.info(`Incoming Webhook: ${JSON.stringify(payload)}`);
    try {
        const { reference, status, message } = payload;
        if (!reference) {
            return res.status(400).send({ success: false, message: 'Missing reference' });
        }
        const transaction = storage_1.storageService.getTransaction(reference);
        if (!transaction) {
            logger_1.default.warn(`Webhook received for unknown transaction: ${reference}`);
            return res.status(404).send({ success: false, message: 'Transaction not found' });
        }
        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash || payload.blockchain_tx_id || payload.transaction_id;
        storage_1.storageService.updateTransactionStatus(reference, status, txHash);
        const notifiableStatuses = ['COMPLETED', 'FAILED', 'EXPIRED'];
        if (notifiableStatuses.includes(status)) {
            const destAmount = ((_a = payload.destination) === null || _a === void 0 ? void 0 : _a.amount) || payload.destinationAmount || payload.destination_amount;
            const destCurrency = ((_b = payload.destination) === null || _b === void 0 ? void 0 : _b.currency) || payload.destinationCurrency || payload.destination_currency;
            const rate = payload.rate;
            const walletAddress = transaction.wallet_address || ((_c = payload.beneficiary) === null || _c === void 0 ? void 0 : _c.account_number) || ((_d = payload.destination) === null || _d === void 0 ? void 0 : _d.address);
            let extra = {
                type: transaction.type,
                walletAddress,
                destinationAmount: destAmount,
                destinationCurrency: destCurrency,
                rate,
            };
            await notification_1.notificationService.sendUpdate(transaction.user_id, reference, status, transaction.asset, transaction.amount, txHash, message, extra);
        }
        return res.send({ success: true });
    }
    catch (error) {
        logger_1.default.error(`Webhook handling failed: ${error.message}`);
        return res.status(500).send({ success: false, message: error.message });
    }
});
const scheduler_1 = require("../services/scheduler");
function startServer() {
    const port = config_1.config.port;
    app.listen(port, () => {
        logger_1.default.info(`🌐 Webhook server listening on port ${port}`);
        (0, scheduler_1.startScheduler)();
        const selfUrl = config_1.config.baseUrl || `http://localhost:${port}`;
        logger_1.default.info(`⏰ Self-ping scheduled for: ${selfUrl} (every 60s)`);
        const axios = require('axios');
        setInterval(async () => {
            try {
                await axios.get(`${selfUrl}/health`);
            }
            catch (e) {
                logger_1.default.warn(`💓 Heartbeat failed for ${selfUrl}: ${e.message}`);
            }
        }, 60000);
    });
}
//# sourceMappingURL=index.js.map