import { bot } from '../bot';
import { getExplorerLink } from '../utils';
import logger from '../utils/logger';

export class NotificationService {
    async sendUpdate(userId: number, reference: string, status: string, asset: string, amount: number, txHash?: string, message?: string) {
        try {
            const emojiMap: Record<string, string> = {
                'RECEIVED': '📥',
                'PROCESSING': '⚙️',
                'COMPLETED': '✅',
                'FAILED': '❌',
                'EXPIRED': '⏰',
                'VERIFIED': '✨',
                'AWAITING_DEPOSIT': '⏳'
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
            } else if (status === 'FAILED') {
                statusText = '❌ Failed';
                additionalInfo = 'The transaction could not be completed. Please contact support.';
            } else if (status === 'EXPIRED') {
                statusText = '⏰ Expired';
                additionalInfo = 'The transaction expired before payment was received.';
            }

            const explorerLink = txHash ? getExplorerLink(asset, txHash) : '';
            const assetName = asset.split(':')[1]?.toUpperCase() || asset;

            const notifyMsg = `
${emoji} <b>Transaction Update</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>Status:</b> <b>${statusText}</b>
${message ? `💬 <b>Note:</b> ${message}` : ''}
${additionalInfo ? `ℹ️ ${additionalInfo}` : ''}

💰 <b>Amount:</b> ${amount} ${assetName}

${explorerLink ? `🔗 <b>Blockchain Hash:</b>\n<a href="${explorerLink}">${txHash}</a>` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            const extra: any = { parse_mode: 'HTML', disable_web_page_preview: true };

            if (explorerLink) {
                extra.reply_markup = {
                    inline_keyboard: [[{ text: '🔍 View on Explorer', url: explorerLink }]]
                };
            }

            await bot.telegram.sendMessage(userId, notifyMsg, extra);
            logger.info(`Notification sent to ${userId} for ${reference} (${status})`);
        } catch (error: any) {
            logger.error(`Failed to send notification to ${userId}: ${error.message}`);
        }
    }
}

export const notificationService = new NotificationService();
