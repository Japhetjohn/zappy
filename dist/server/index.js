"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const bot_1 = require("../bot");
const storage_1 = require("../services/storage");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const utils_1 = require("../utils");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.status(200).send('Bitnova Africa Bot Server is Running ⚡️');
});
app.post('/webhook', async (req, res) => {
    var _a;
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
        storage_1.storageService.updateTransactionStatus(reference, status);
        const userId = transaction.user_id;
        const emojiMap = {
            'RECEIVED': '📥',
            'PROCESSING': '⚙️',
            'COMPLETED': '✅',
            'FAILED': '❌',
            'EXPIRED': '⏰',
            'VERIFIED': 'zp_verified'
        };
        const emoji = emojiMap[status] || 'ℹ️';
        let statusText = status;
        let additionalInfo = '';
        if (status === 'VERIFIED') {
            statusText = '✨ Verified';
            additionalInfo = 'Your payment has been verified and is being processed.';
        }
        else if (status === 'PROCESSING') {
            statusText = '⚙️ Processing';
            additionalInfo = 'We are sending your funds to the destination.';
        }
        else if (status === 'COMPLETED') {
            statusText = '✅ Completed';
            additionalInfo = 'Transaction successfully finished!';
        }
        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash;
        const explorerLink = txHash ? (0, utils_1.getExplorerLink)(transaction.asset, txHash) : '';
        const notifyMsg = `
${emoji} <b>Transaction Update</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>Status:</b> <b>${statusText}</b>
${message ? `💬 <b>Note:</b> ${message}` : ''}
${additionalInfo ? `ℹ️ ${additionalInfo}` : ''}

💰 <b>Amount:</b> ${transaction.amount} ${((_a = transaction.asset.split(':')[1]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || transaction.asset}

${explorerLink ? `🔗 <b>Blockchain Hash:</b>\n<a href="${explorerLink}">${txHash}</a>` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        const extra = { parse_mode: 'HTML', disable_web_page_preview: true };
        if (explorerLink) {
            extra.reply_markup = {
                inline_keyboard: [[{ text: '🔍 View on Explorer', url: explorerLink }]]
            };
        }
        await bot_1.bot.telegram.sendMessage(userId, notifyMsg, extra);
        logger_1.default.info(`Notified user ${userId} about transaction ${reference} status ${status}`);
        return res.send({ success: true });
    }
    catch (error) {
        logger_1.default.error(`Webhook handling failed: ${error.message}`);
        return res.status(500).send({ success: false, message: error.message });
    }
});
function startServer() {
    const port = config_1.config.port;
    app.listen(port, () => {
        logger_1.default.info(`🌐 Webhook server listening on port ${port}`);
        const selfUrl = config_1.config.baseUrl || `http://localhost:${port}`;
        setInterval(async () => {
            try {
                const axios = require('axios');
                await axios.get(`${selfUrl}/health`);
                logger_1.default.debug(`💓 Heartbeat: Self-ping to ${selfUrl} successful`);
            }
            catch (e) {
                logger_1.default.warn(`💓 Heartbeat failed for ${selfUrl}: ${e.message}`);
            }
        }, 300000);
    });
}
//# sourceMappingURL=index.js.map