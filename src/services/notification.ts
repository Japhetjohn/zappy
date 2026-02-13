import { bot } from '../bot';
import { getExplorerLink } from '../utils';
import logger from '../utils/logger';

export class NotificationService {

    /**
     * Send a rich, stage-specific notification to the user.
     * Each status gets a unique, reassuring message.
     */
    async sendUpdate(
        userId: number,
        reference: string,
        status: string,
        asset: string,
        amount: number,
        txHash?: string,
        message?: string,
        extraData?: {
            destinationAmount?: number;
            destinationCurrency?: string;
            rate?: number;
            type?: string;
        }
    ) {
        try {
            const assetName = asset.split(':')[1]?.toUpperCase() || asset.toUpperCase();
            const explorerLink = txHash ? getExplorerLink(asset, txHash) : '';
            let notifyMsg = '';

            switch (status) {
                case 'RECEIVED':
                case 'AWAITING_CONFIRMATION':
                    // 🎯 DEPOSIT DETECTED — Crypto arrived on-chain
                    notifyMsg = `
🏦 <b>Deposit Detected</b>

We've received <b>${amount} ${assetName}</b> on the Solana network.

Your transaction is being confirmed.
Once completed, your funds will be processed automatically.

No action needed. Your funds are safe. ✅

Ref: <code>${reference}</code>
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                case 'VERIFIED':
                    // ✨ PAYMENT VERIFIED
                    notifyMsg = `
✨ <b>Payment Verified</b>

Your deposit of <b>${amount} ${assetName}</b> has been verified on-chain.

We're now processing your payout. You'll receive your funds shortly.

No action needed. Sit tight! 🚀

Ref: <code>${reference}</code>
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                case 'PROCESSING':
                    // ⚙️ PROCESSING — Funds being sent
                    notifyMsg = `
⚙️ <b>Processing Payout</b>

Your transaction is being processed.
${extraData?.destinationAmount ? `\n💸 <b>Payout:</b> ${extraData.destinationCurrency === 'NGN' ? '₦' : '$'}${Number(extraData.destinationAmount).toLocaleString()}` : ''}

Funds are on their way to your destination.
This usually takes less than 2 minutes. ⏳

Ref: <code>${reference}</code>

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                case 'COMPLETED':
                    // ✅ TRANSACTION COMPLETE — The money shot!
                    {
                        const destAmount = extraData?.destinationAmount;
                        const destCurrency = extraData?.destinationCurrency || '';
                        const rate = extraData?.rate;
                        const currencySymbol = destCurrency === 'NGN' ? '₦' : '$';
                        const txType = extraData?.type || '';

                        if (txType === 'OFFRAMP') {
                            // Sold crypto → Got cash
                            notifyMsg = `
✅ <b>Transaction Complete!</b>

<b>${amount} ${assetName}</b> has been sold successfully.
${rate ? `📊 Rate: ${currencySymbol}${Number(rate).toLocaleString()}` : ''}
${destAmount ? `\n💰 <b>${currencySymbol}${Number(destAmount).toLocaleString()}</b> has been sent to your bank account.` : ''}

Ref: <code>${reference}</code>
${explorerLink ? `🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

Type <b>Menu</b> to continue 🚀

<i>Powered by Bitnova Africa</i> ⚡️
`;
                        } else {
                            // Bought crypto → Got USDT
                            notifyMsg = `
✅ <b>Transaction Complete!</b>

Your purchase of <b>${amount} ${assetName}</b> is complete!
${rate ? `📊 Rate: ₦${Number(rate).toLocaleString()}` : ''}

Crypto has been sent to your wallet. 🎉

Ref: <code>${reference}</code>
${explorerLink ? `🔗 <a href="${explorerLink}">View on Explorer</a>\n` : ''}
Type <b>Menu</b> to continue 🚀

<i>Powered by Bitnova Africa</i> ⚡️
`;
                        }
                    }
                    break;

                case 'FAILED':
                    notifyMsg = `
❌ <b>Transaction Failed</b>

Unfortunately, your transaction could not be completed.

💰 <b>Amount:</b> ${amount} ${assetName}
📋 <b>Ref:</b> <code>${reference}</code>
${message ? `\n💬 <b>Reason:</b> ${message}` : ''}

If funds were deducted, they will be refunded automatically.
Need help? Contact our support team.

Type <b>Menu</b> to try again 🔄

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                case 'EXPIRED':
                    notifyMsg = `
⏰ <b>Transaction Expired</b>

Your transaction expired before payment was received.

💰 <b>Amount:</b> ${amount} ${assetName}
📋 <b>Ref:</b> <code>${reference}</code>

No funds were charged. You can start a new transaction anytime!

Type <b>Menu</b> to start fresh 🔄

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                case 'CANCELLED':
                    notifyMsg = `
🚫 <b>Transaction Cancelled</b>

Your transaction has been cancelled.

💰 <b>Amount:</b> ${amount} ${assetName}
📋 <b>Ref:</b> <code>${reference}</code>
${message ? `\n💬 <b>Reason:</b> ${message}` : ''}

No funds were charged.
Type <b>Menu</b> to start a new transaction 🔄

<i>Powered by Bitnova Africa</i> ⚡️
`;
                    break;

                default:
                    // Generic fallback
                    notifyMsg = `
ℹ️ <b>Transaction Update</b>

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>Status:</b> <b>${status}</b>
💰 <b>Amount:</b> ${amount} ${assetName}
${message ? `💬 ${message}` : ''}
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>Powered by Bitnova Africa</i> ⚡️
`;
            }

            const extra: any = {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        ...(explorerLink ? [[{ text: '🔍 View on Explorer', url: explorerLink }]] : []),
                        [{ text: '🔄 Check Status', callback_data: `status_${reference}` }],
                        [{ text: '🏠 Main Menu', callback_data: 'action_menu' }]
                    ]
                }
            };

            await bot.telegram.sendMessage(userId, notifyMsg, extra);
            logger.info(`📨 Notification sent to ${userId} for ${reference} (${status})`);
        } catch (error: any) {
            logger.error(`Failed to send notification to ${userId}: ${error.message}`);
        }
    }
}

export const notificationService = new NotificationService();
