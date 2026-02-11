import express, { Request, Response } from 'express';
import { bot } from '../bot';
import { storageService } from '../services/storage';
import { config } from '../config';
import logger from '../utils/logger';
import { getExplorerLink } from '../utils'; // Import explorer utility

const app = express();
app.use(express.json());

// 🩺 Health Check Endpoints
app.get('/health', (req: Request, res: Response) => {
    res.status(200).send({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Bitnova Africa Bot Server is Running ⚡️');
});

app.post('/webhook', async (req: Request, res: Response) => {
    const payload = req.body;
    logger.info(`Incoming Webhook: ${JSON.stringify(payload)}`);

    try {
        const { reference, status, message } = payload;

        if (!reference) {
            return res.status(400).send({ success: false, message: 'Missing reference' });
        }

        const transaction = storageService.getTransaction(reference);
        if (!transaction) {
            logger.warn(`Webhook received for unknown transaction: ${reference}`);
            return res.status(404).send({ success: false, message: 'Transaction not found' });
        }

        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash;

        // Update database status
        storageService.updateTransactionStatus(reference, status, txHash);

        // Notify user
        const userId = transaction.user_id; // Note: Database column is user_id
        const emojiMap: Record<string, string> = {
            'RECEIVED': '📥',
            'PROCESSING': '⚙️',
            'COMPLETED': '✅',
            'FAILED': '❌',
            'EXPIRED': '⏰',
            'VERIFIED': 'zp_verified' // Custom placeholder if needed, or use generic
        };
        const emoji = emojiMap[status] || 'ℹ️';

        let statusText = status;
        let additionalInfo = '';

        if (status === 'VERIFIED') {
            statusText = '✨ Verified';
            additionalInfo = 'Your payment has been verified and is being processed.';
        } else if (status === 'PROCESSING') {
            statusText = '⚙️ Processing';
            additionalInfo = 'We are sending your funds to the destination.';
        } else if (status === 'COMPLETED') {
            statusText = '✅ Completed';
            additionalInfo = 'Transaction successfully finished!';
        }

        // Generate Explorer Link
        const explorerLink = txHash ? getExplorerLink(transaction.asset, txHash) : '';

        const notifyMsg = `
${emoji} <b>Transaction Update</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>Status:</b> <b>${statusText}</b>
${message ? `💬 <b>Note:</b> ${message}` : ''}
${additionalInfo ? `ℹ️ ${additionalInfo}` : ''}

💰 <b>Amount:</b> ${transaction.amount} ${transaction.asset.split(':')[1]?.toUpperCase() || transaction.asset}

${explorerLink ? `🔗 <b>Blockchain Hash:</b>\n<a href="${explorerLink}">${txHash}</a>` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        const extra: any = { parse_mode: 'HTML', disable_web_page_preview: true };

        // Add button if link exists
        if (explorerLink) {
            extra.reply_markup = {
                inline_keyboard: [[{ text: '🔍 View on Explorer', url: explorerLink }]]
            };
        }

        await bot.telegram.sendMessage(userId, notifyMsg, extra);
        logger.info(`Notified user ${userId} about transaction ${reference} status ${status}`);

        return res.send({ success: true });
    } catch (error: any) {
        logger.error(`Webhook handling failed: ${error.message}`);
        return res.status(500).send({ success: false, message: error.message });
    }
});

import { startScheduler } from '../services/scheduler';

export function startServer() {
    const port = config.port;
    app.listen(port, () => {
        logger.info(`🌐 Webhook server listening on port ${port}`);

        // Start background tasks
        startScheduler();

        // 🚀 Self-Ping Mechanism (Prevents sleeping on render/railway/etc)
        const selfUrl = config.baseUrl || `http://localhost:${port}`;

        setInterval(async () => {
            try {
                const axios = require('axios');
                await axios.get(`${selfUrl}/health`);
                logger.debug(`💓 Heartbeat: Self-ping to ${selfUrl} successful`);
            } catch (e: any) {
                logger.warn(`💓 Heartbeat failed for ${selfUrl}: ${e.message}`);
            }
        }, 300000); // Every 5 minutes for higher reliability
    });
}
