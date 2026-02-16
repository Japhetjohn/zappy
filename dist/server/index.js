"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const storage_1 = require("../services/storage");
const switch_1 = require("../services/switch");
const notification_1 = require("../services/notification");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.status(200).send('Bitnova Africa Bot Server is Running ⚡️');
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
    try {
        const reference = req.params.reference;
        const tx = storage_1.storageService.getTransaction(reference);
        if (!tx)
            return res.status(404).json({ error: 'Transaction not found' });
        logger_1.default.info(`🚨 Admin manual confirmation triggered for ${reference}`);
        const result = await switch_1.switchService.confirmDeposit(reference);
        storage_1.storageService.updateTransactionStatus(reference, result.status || 'PROCESSING');
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
app.get('/api/admin/settings', adminAuth, (req, res) => {
    try {
        const settings = storage_1.storageService.getSettings();
        res.json(settings);
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
        storage_1.storageService.updateSetting(key, value.toString());
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
const path_1 = __importDefault(require("path"));
const publicPath = path_1.default.resolve(process.cwd(), 'public');
logger_1.default.info(`🚨 SERVING STATIC FROM: ${publicPath}`);
app.use('/admin', express_1.default.static(path_1.default.join(publicPath, 'admin')));
app.get(['/admin', '/admin/*'], (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'admin/index.html'));
});
app.post('/webhook', async (req, res) => {
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
        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash;
        storage_1.storageService.updateTransactionStatus(reference, status, txHash);
        const notifiableStatuses = ['VERIFIED', 'COMPLETED', 'FAILED', 'EXPIRED'];
        if (notifiableStatuses.includes(status)) {
            let extra = { type: transaction.type };
            if (status === 'COMPLETED' || status === 'VERIFIED') {
                const txDetail = storage_1.storageService.getTransactionDetails(reference);
                if (txDetail) {
                    extra.destinationAmount = txDetail.destination_amount;
                    extra.destinationCurrency = txDetail.destination_currency;
                    extra.rate = txDetail.rate;
                }
            }
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