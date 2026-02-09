import express, { Request, Response } from 'express';
import { bot } from '../bot';
import { storageService } from '../services/storage';
import { config } from '../config';
import logger from '../utils/logger';

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
        const userId = transaction.user_id;
        const emojiMap: Record<string, string> = {
            'RECEIVED': '📥',
            'PROCESSING': '⚙️',
            'COMPLETED': '✅',
            'FAILED': '❌',
            'EXPIRED': '⏰'
        };
        const emoji = emojiMap[status] || 'ℹ️';

        const notifyMsg = `
${emoji} <b>Transaction Update</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>New Status:</b> <b>${status}</b>
${message ? `💬 <b>Message:</b> ${message}` : ''}

💰 <b>Amount:</b> ${transaction.amount} ${transaction.asset}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>You can click the status button in the menu to see full details.</i>
`;

        await bot.telegram.sendMessage(userId, notifyMsg, { parse_mode: 'HTML' });
        logger.info(`Notified user ${userId} about transaction ${reference} status ${status}`);

        res.send({ success: true });
    } catch (error: any) {
        logger.error(`Webhook handling failed: ${error.message}`);
        res.status(500).send({ success: false, message: error.message });
    }
});

export function startServer() {
    const port = config.port;
    app.listen(port, () => {
        logger.info(`🌐 Webhook server listening on port ${port}`);
    });
}
