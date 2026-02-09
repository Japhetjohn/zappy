import express, { Request, Response } from 'express';
import { bot } from '../bot';
import { storageService } from '../services/storage';
import { config } from '../config';
import logger from '../utils/logger';
import { getExplorerLink } from '../utils'; // Import explorer utility

const app = express();
app.use(express.json());

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

        // Update database status
        storageService.updateTransactionStatus(reference, status);

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
        const txHash = payload.hash || payload.txHash || payload.transactionHash || payload.tx_hash;
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

export function startServer() {
    const port = config.port;
    app.listen(port, () => {
        logger.info(`🌐 Webhook server listening on port ${port}`);
    });
}
