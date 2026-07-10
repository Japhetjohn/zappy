"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const bot_1 = require("../bot");
const utils_1 = require("../utils");
const logger_1 = __importDefault(require("../utils/logger"));
class NotificationService {
    async sendUpdate(userId, reference, status, asset, amount, txHash, message, extraData) {
        var _a;
        try {
            const assetName = ((_a = asset.split(':')[1]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || asset.toUpperCase();
            const explorerLink = txHash ? (0, utils_1.getExplorerLink)(asset, txHash) : '';
            let notifyMsg = '';
            switch (status) {
                case 'RECEIVED':
                case 'AWAITING_CONFIRMATION':
                    notifyMsg = `
🏦 <b>Deposit Detected</b>

We've received <b>${amount} ${assetName}</b> on the Solana network.

Your transaction is being confirmed.
Once completed, your funds will be processed automatically.

No action needed. Your funds are safe. ✅

Ref: <code>${reference}</code>
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>powered by usevelcro.com</i>
`;
                    break;
                case 'VERIFIED':
                    notifyMsg = `
✨ <b>Payment Verified</b>

Your deposit of <b>${amount} ${assetName}</b> has been verified on-chain.

We're now processing your payout. You'll receive your funds shortly.

No action needed. Sit tight! 🚀

Ref: <code>${reference}</code>
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>powered by usevelcro.com</i>
`;
                    break;
                case 'PROCESSING':
                    notifyMsg = `
⚙️ <b>Processing Payout</b>

Your transaction is being processed.
${(extraData === null || extraData === void 0 ? void 0 : extraData.destinationAmount) ? `\n💸 <b>Payout:</b> ${extraData.destinationCurrency === 'NGN' ? '₦' : '$'}${Number(extraData.destinationAmount).toLocaleString()}` : ''}

Funds are on their way to your destination.
This usually takes less than 2 minutes. ⏳

Ref: <code>${reference}</code>

<i>powered by usevelcro.com</i>
`;
                    break;
                case 'COMPLETED':
                    {
                        const destAmount = extraData === null || extraData === void 0 ? void 0 : extraData.destinationAmount;
                        const destCurrency = (extraData === null || extraData === void 0 ? void 0 : extraData.destinationCurrency) || '';
                        const rate = extraData === null || extraData === void 0 ? void 0 : extraData.rate;
                        const currencySymbol = destCurrency === 'NGN' ? '₦' : '$';
                        const txType = (extraData === null || extraData === void 0 ? void 0 : extraData.type) || '';
                        if (txType === 'OFFRAMP') {
                            notifyMsg = `
✅ <b>Transaction Complete!</b>

<b>${amount} ${assetName}</b> has been sold successfully.
${rate ? `📊 Rate: ${currencySymbol}${Number(rate).toLocaleString()}` : ''}
${destAmount ? `\n💰 <b>${currencySymbol}${Number(destAmount).toLocaleString()}</b> has been sent to your bank account.` : ''}

🏦 <b>Bank Account:</b>
<code>${(extraData === null || extraData === void 0 ? void 0 : extraData.walletAddress) || 'N/A'}</code>

Ref: <code>${reference}</code>
${explorerLink ? `🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>powered by usevelcro.com</i>
`;
                        }
                        else {
                            notifyMsg = `
✅ <b>Transaction Complete!</b>

Your purchase of <b>${(extraData === null || extraData === void 0 ? void 0 : extraData.destinationAmount) ? extraData.destinationAmount : amount} ${assetName}</b> is complete!
${rate ? `📊 Rate: ₦${Number(rate).toLocaleString()}` : ''}

🚀 <b>Destination Wallet:</b>
<code>${(extraData === null || extraData === void 0 ? void 0 : extraData.walletAddress) || 'N/A'}</code>

Crypto has been sent to your wallet. 🎉

Ref: <code>${reference}</code>
${explorerLink ? `🔗 <a href="${explorerLink}">View on Explorer</a>\n` : ''}

<i>powered by usevelcro.com</i>
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

<i>powered by usevelcro.com</i>
`;
                    break;
                case 'EXPIRED':
                    notifyMsg = `
⏰ <b>Transaction Expired</b>

Your transaction expired before payment was received.

💰 <b>Amount:</b> ${amount} ${assetName}
📋 <b>Ref:</b> <code>${reference}</code>

No funds were charged. You can start a new transaction anytime!

<i>powered by usevelcro.com</i>
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

<i>powered by usevelcro.com</i>
`;
                    break;
                default:
                    notifyMsg = `
ℹ️ <b>Transaction Update</b>

📋 <b>Ref:</b> <code>${reference}</code>
🚦 <b>Status:</b> <b>${status}</b>
💰 <b>Amount:</b> ${amount} ${assetName}
${message ? `💬 ${message}` : ''}
${explorerLink ? `\n🔗 <a href="${explorerLink}">View on Explorer</a>` : ''}

<i>powered by usevelcro.com</i>
`;
            }
            const extra = {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        ...(explorerLink ? [[{ text: '🔍 View on Explorer', url: explorerLink }]] : []),
                        [{ text: '📞 Contact Support', url: 'https://t.me/usevelcro_chat' }],
                        [{ text: '🏠 Main Menu', callback_data: 'action_menu' }]
                    ]
                }
            };
            await bot_1.bot.telegram.sendMessage(userId, notifyMsg, extra);
            logger_1.default.info(`📨 Notification sent to ${userId} for ${reference} (${status})`);
        }
        catch (error) {
            logger_1.default.error(`Failed to send notification to ${userId}: ${error.message}`);
        }
    }
    async sendReferralCreditNotification(userId, amount) {
        try {
            const notifyMsg = `
🎁 <b>Referral Bonus Received!</b>

Your referral just completed a transaction, and you've earned a portion of the volume!

💰 <b>Amount Credited:</b> $${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}

Keep sharing your referral link to earn more! 🚀
            `;
            const extra = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '👥 View Referrals', callback_data: 'action_referrals' }]]
                }
            };
            await bot_1.bot.telegram.sendMessage(userId, notifyMsg, extra);
        }
        catch (e) {
            logger_1.default.error(`Failed to send referral notification to ${userId}: ${e.message}`);
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.js.map