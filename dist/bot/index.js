"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
exports.startBot = startBot;
const telegraf_1 = require("telegraf");
const https_proxy_agent_1 = require("https-proxy-agent");
const config_1 = require("../config");
const onramp_1 = require("./scenes/onramp");
const offramp_1 = require("./scenes/offramp");
const storage_1 = require("../services/storage");
const switch_1 = require("../services/switch");
const index_1 = require("../utils/index");
const logger_1 = __importDefault(require("../utils/logger"));
exports.bot = new telegraf_1.Telegraf(config_1.config.botToken, {
    handlerTimeout: 90000,
    telegram: {
        agent: config_1.config.telegramProxy ? new https_proxy_agent_1.HttpsProxyAgent(config_1.config.telegramProxy) : undefined,
    }
});
let botUsername = null;
async function getBotUsername() {
    if (botUsername)
        return botUsername;
    try {
        const me = await exports.bot.telegram.getMe();
        botUsername = me.username;
        return botUsername;
    }
    catch (e) {
        logger_1.default.error(`Failed to fetch bot username: ${e.message}`);
        return null;
    }
}
const stage = new telegraf_1.Scenes.Stage([onramp_1.onrampWizard, offramp_1.offrampWizard]);
exports.bot.use((0, telegraf_1.session)());
exports.bot.use((ctx, next) => {
    var _a;
    const updateType = ctx.updateType;
    const from = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id) || 'unknown';
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    logger_1.default.info(`Update: [${updateType}] from [${from}]${text ? ` text: ${text}` : ''}`);
    return next();
});
exports.bot.command('points', async (ctx) => {
    if (!ctx.from)
        return;
    try {
        const pointSettings = storage_1.storageService.getPointSettings();
        const points = storage_1.storageService.getUserPoints(ctx.from.id);
        const pointsUsed = Math.min(points, pointSettings.maxPerTx);
        const bonusPct = pointsUsed * pointSettings.valuePct;
        await ctx.replyWithHTML(`
🎁 <b>Your Bonus Points</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ <b>Total Points Acquired:</b> ${points.toLocaleString()}

🎁 <b>Next Transaction Bonus:</b> ${bonusPct}%

💡 <i>You earn 1 point for every completed transaction.</i>
💡 <i>Do more transactions to unlock higher bonuses</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

The more you trade, the bigger your bonus! 🚀
`, keyboards_1.MAIN_KEYBOARD);
    }
    catch (err) {
        logger_1.default.error(`Error in /points command: ${err.message}`);
        await ctx.reply('❌ Could not fetch your points balance.');
    }
});
exports.bot.command('referrals', async (ctx) => {
    if (!ctx.from)
        return;
    try {
        const stats = storage_1.storageService.getUserReferralStats(ctx.from.id);
        const username = await getBotUsername();
        const link = username ? `https://t.me/${username}?start=${stats.code}` : 'Link unavailable';
        await ctx.replyWithHTML(`
👥 <b>My Referrals</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 <b>Your referral link:</b>
<code>${link}</code>

👤 <b>Referrals:</b> ${stats.referralCount}
⭐ <b>Points earned:</b> ${stats.referralPointsEarned}

💡 <i>Share your link and earn 5 points for every friend who joins!</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

powered by usevelcro.com
`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.url('📤 Share Link', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join me on usevelcro and earn bonuses on every crypto transaction!')}`)],
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    }
    catch (err) {
        logger_1.default.error(`Error in /referrals command: ${err.message}`);
        await ctx.reply('❌ Could not fetch your referral info.');
    }
});
exports.bot.command('start', async (ctx) => {
    var _a, _b, _c;
    try {
        if (ctx.session) {
            ctx.session.__scenes = undefined;
        }
        logger_1.default.info(`Processing /start command for ${(_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id}`);
        const name = ((_b = ctx.from) === null || _b === void 0 ? void 0 : _b.first_name) || 'Friend';
        let referrerId;
        const refCode = ctx.startPayload || ctx.payload;
        if (refCode && ctx.from) {
            const referrer = storage_1.storageService.getUserByReferralCode(refCode.toUpperCase());
            if (referrer && referrer.id !== ctx.from.id) {
                referrerId = referrer.id;
            }
        }
        if (ctx.from) {
            try {
                const isNewUser = storage_1.storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown', `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim());
                if (isNewUser && referrerId) {
                    const recorded = storage_1.storageService.recordReferral(ctx.from.id, referrerId);
                    if (recorded) {
                        const referredUsername = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Someone');
                        try {
                            await exports.bot.telegram.sendMessage(referrerId, `${referredUsername} used your referral link, you have earned 5 points, powered by usevelcro.com`);
                        }
                        catch (notifyErr) {
                            logger_1.default.error(`Failed to notify referrer ${referrerId}: ${notifyErr.message}`);
                        }
                    }
                }
            }
            catch (err) {
                logger_1.default.error(`Failed to register user ${(_c = ctx.from) === null || _c === void 0 ? void 0 : _c.id}: ${err.message}`);
            }
        }
        const msg = getWelcomeMsg(name);
        await ctx.replyWithHTML(msg, keyboards_1.MAIN_KEYBOARD);
    }
    catch (err) {
        logger_1.default.error(`Error in /start command: ${err.message}`);
        logger_1.default.error(err.stack);
        try {
            await ctx.reply('⚠️ Something went wrong. Please try again.');
        }
        catch (e) {
            logger_1.default.error('Failed to send error message to user');
        }
    }
});
exports.bot.use(stage.middleware());
const getWelcomeMsg = (name) => `
Hello ${name} 👋

My name is <b>Velcro</b>, your friendly crypto assistant! 🤖✨

I'm here to make buying and selling crypto super easy, fast, and secure for you. Whether you want to turn cash into crypto or crypto into cash, I've got you covered! 🚀

<b>Here is what I can do for you:</b>
💰 <b>Buy Crypto:</b> Get crypto sent directly to your wallet.
💸 <b>Sell Crypto:</b> Turn your crypto into cash in your bank account.

<i>Ready to get started? Tap a button below!</i> 👇
`;
const keyboards_1 = require("./keyboards");
const ADMIN_USERNAMES = ['@official_johny01', 'kamalkt6'];
exports.bot.command('stats', async (ctx) => {
    var _a, _b;
    const username = (_b = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.username) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    if (!username || !ADMIN_USERNAMES.includes(username)) {
        await ctx.replyWithHTML(`🔒 <b>Access Denied</b>\n\nSorry, this command is for <b>Velcro Admins</b> only.\n\nIf you need help, type /help or join our community! 🌍`);
        return;
    }
    try {
        const stats = storage_1.storageService.getStats();
        const fees = await switch_1.switchService.getDeveloperFees();
        const msg = `
📊 <b>Velcro Platform Stats</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 <b>Total Users:</b> ${stats.totalUsers.toLocaleString()}
📝 <b>Total Transactions:</b> ${stats.allTransactions.toLocaleString()}
✅ <b>Successful Transfers:</b> ${stats.completedTransactions.toLocaleString()}

💰 <b>Volume USD:</b> $${Number(stats.totalVolumeUSD).toLocaleString()}
💰 <b>Volume NGN:</b> ₦${Number(stats.totalVolumeNGN).toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💸 <b>Developer Fees:</b> ${fees.amount.toLocaleString()} ${fees.currency}

<i>Scale: Ready for 20k+ users/day</i> 🌍⚡️
`;
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('💸 Withdraw Fees', 'withdraw_fees')],
            [telegraf_1.Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    }
    catch (err) {
        logger_1.default.error(`Error in /stats command: ${err.message}`);
        await ctx.reply('❌ Error fetching stats/fees.');
    }
});
exports.bot.action('withdraw_fees', async (ctx) => {
    var _a, _b;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    const username = (_b = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.username) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    if (!username || !ADMIN_USERNAMES.includes(username))
        return;
    try {
        const fees = await switch_1.switchService.getDeveloperFees();
        if (fees.amount <= 0) {
            return await ctx.reply('❌ No fees available to withdraw.');
        }
        const msg = `
💸 <b>Withdraw Developer Fees</b>

Current Balance: <b>${fees.amount} ${fees.currency}</b>

Please enter the <b>Solana Wallet Address</b> where you want to receive your USDC payout:
`;
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'action_menu')]
        ]));
        ctx.session.awaiting_withdraw_address = true;
        return;
    }
    catch (e) {
        return await ctx.reply(`❌ Error: ${e.message}`);
    }
});
exports.bot.on('text', async (ctx, next) => {
    if (ctx.session.awaiting_withdraw_address) {
        const address = ctx.message.text.trim();
        if (address.length < 32)
            return ctx.reply('❌ Invalid wallet address. Please try again.');
        delete ctx.session.awaiting_withdraw_address;
        try {
            await ctx.reply('⏳ Processing withdrawal...');
            const result = await switch_1.switchService.withdrawDeveloperFees('base:usdc', address);
            await ctx.replyWithHTML(`✅ <b>Withdrawal Successful!</b>\n\nReference: <code>${result.reference}</code>\n\nFunds will arrive shortly.`);
        }
        catch (e) {
            await ctx.reply(`❌ Withdrawal Failed: ${e.message}`);
        }
        return;
    }
    return next();
});
exports.bot.action('action_menu', async (ctx) => {
    var _a, _b, _c;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    try {
        if ((_a = ctx.scene) === null || _a === void 0 ? void 0 : _a.current) {
            await ctx.scene.leave();
        }
        const name = ((_b = ctx.from) === null || _b === void 0 ? void 0 : _b.first_name) || 'Friend';
        await (0, index_1.safeEdit)(ctx, getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
    }
    catch (err) {
        try {
            const name = ((_c = ctx.from) === null || _c === void 0 ? void 0 : _c.first_name) || 'Friend';
            await ctx.replyWithHTML(getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
        }
        catch (e) {
            logger_1.default.error(`action_menu fallback failed: ${e.message}`);
        }
    }
});
exports.bot.action('action_onramp', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('onramp-wizard');
});
exports.bot.action('action_offramp', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('offramp-wizard');
});
exports.bot.action('action_beneficiaries', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    if (!ctx.from)
        return;
    const beneficiaries = storage_1.storageService.getBeneficiaries(ctx.from.id);
    let msg = `
📂 <b>Saved Accounts</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    if (beneficiaries.length === 0) {
        msg += `<i>No saved accounts yet.</i>\n\nAccounts are saved automatically after your first sale.`;
    }
    else {
        beneficiaries.forEach((b, i) => {
            msg += `<b>${i + 1}.</b> ${b.holderName}\n   ${b.bankName} • <code>${b.accountNumber}</code>\n\n`;
        });
    }
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});
exports.bot.action('action_rates', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Fetching rates...').catch(() => { });
    await handleRates(ctx);
});
exports.bot.action('action_help', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    await handleHelp(ctx);
});
exports.bot.action('action_history', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Fetching history...').catch(() => { });
    await handleHistory(ctx);
});
exports.bot.action('action_points', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Fetching points...').catch(() => { });
    if (!ctx.from)
        return;
    try {
        const pointSettings = storage_1.storageService.getPointSettings();
        const points = storage_1.storageService.getUserPoints(ctx.from.id);
        const pointsUsedAction = Math.min(points, pointSettings.maxPerTx);
        const bonusPctAction = pointsUsedAction * pointSettings.valuePct;
        await ctx.replyWithHTML(`
🎁 <b>Your Bonus Points</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ <b>Total Points Acquired:</b> ${points.toLocaleString()}

🎁 <b>Next Transaction Bonus:</b> ${bonusPctAction}%

💡 <i>You earn 1 point for every completed transaction.</i>
💡 <i>Do more transactions to unlock higher bonuses</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

The more you trade, the bigger your bonus! 🚀
`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    }
    catch (err) {
        logger_1.default.error(`Error in action_points: ${err.message}`);
        await ctx.reply('❌ Could not fetch your points balance.');
    }
});
exports.bot.action('action_referrals', async (ctx) => {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Fetching referrals...').catch(() => { });
    if (!ctx.from)
        return;
    try {
        const stats = storage_1.storageService.getUserReferralStats(ctx.from.id);
        const username = await getBotUsername();
        const link = username ? `https://t.me/${username}?start=${stats.code}` : 'Link unavailable';
        await ctx.replyWithHTML(`
👥 <b>My Referrals</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 <b>Your referral link:</b>
<code>${link}</code>

👤 <b>Referrals:</b> ${stats.referralCount}
⭐ <b>Points earned:</b> ${stats.referralPointsEarned}

💡 <i>Share your link and earn 5 points for every friend who joins!</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

powered by usevelcro.com
`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.url('📤 Share Link', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join me on usevelcro and earn bonuses on every crypto transaction!')}`)],
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    }
    catch (err) {
        logger_1.default.error(`Error in action_referrals: ${err.message}`);
        await ctx.reply('❌ Could not fetch your referral info.');
    }
});
exports.bot.action(/^status_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Updating...').catch(() => { });
    try {
        const status = await switch_1.switchService.getStatus(reference);
        const transaction = storage_1.storageService.getTransaction(reference);
        if (transaction && transaction.status !== status.status) {
            storage_1.storageService.updateTransactionStatus(reference, status.status);
        }
        const updatedTx = storage_1.storageService.getTransaction(reference);
        const hash = (updatedTx === null || updatedTx === void 0 ? void 0 : updatedTx.hash) || '';
        const msg = formatStatusMessage(status, hash);
        const redoAction = (transaction === null || transaction === void 0 ? void 0 : transaction.type) === 'OFFRAMP' ? 'action_offramp' : 'action_onramp';
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Refresh Status', `status_${reference}`)],
            [telegraf_1.Markup.button.url('📞 Contact Support', 'https://t.me/usevelcro')],
            [telegraf_1.Markup.button.callback('🔁 Redo Transaction', redoAction)],
            [telegraf_1.Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    }
    catch (e) {
        await ctx.replyWithHTML('⏳ <b>Transaction Processing...</b>\n\nPlease wait a moment while we update the status from the network.');
    }
});
exports.bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Notifying system...').catch(() => { });
    try {
        await switch_1.switchService.confirmDeposit(reference);
        await ctx.replyWithHTML(`✅ <b>Payment Notified</b>\n\nReference: <code>${reference}</code>\n\nWe are now verifying your transfer.`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
    }
});
exports.bot.action('cancel', async (ctx) => {
    var _a;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.leave();
    const name = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Friend';
    await (0, index_1.safeEdit)(ctx, getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
});
function formatStatusMessage(status, hash) {
    const emojiMap = {
        'PENDING': '⏳', 'PROCESSING': '⚙️', 'COMPLETED': '✅', 'FAILED': '❌', 'EXPIRED': '⏰', 'RECEIVED': '📥', 'VERIFIED': '✨'
    };
    const emoji = emojiMap[status.status] || 'ℹ️';
    return `
${emoji} <b>Transaction Status</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${status.reference}</code>
🚦 <b>Status:</b> <b>${status.status}</b>

💰 <b>You Sent/Requested:</b> ${(0, index_1.formatAmount)(status.source.amount)} ${status.source.currency}
💵 <b>Estimated Payout:</b> ${(0, index_1.formatAmount)(status.destination.amount)} ${status.destination.currency}

${hash ? `🔗 <b>Transaction Hash:</b>\n<code>${hash}</code>` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Updated: ${new Date().toLocaleTimeString()}</i>
`;
}
exports.bot.hears(/\b(hi|hello|hey|yo|start|menu|home)\b/i, async (ctx) => {
    var _a, _b;
    try {
        logger_1.default.info(`Processing HEARS trigger for ${(_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id}. Scene: ${ctx.scene.current ? ctx.scene.current.id : 'none'}`);
        if (ctx.scene.current) {
            logger_1.default.info(`Returning because user is in scene: ${ctx.scene.current.id}`);
            return;
        }
        const name = ((_b = ctx.from) === null || _b === void 0 ? void 0 : _b.first_name) || 'Friend';
        await ctx.replyWithHTML(getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
    }
    catch (err) {
        logger_1.default.error(`Error in hears handler: ${err.message}`);
    }
});
exports.bot.hears(/\b(buy|send|onramp|deposit|crypto)\b/i, async (ctx) => {
    if (ctx.scene.current)
        return;
    await ctx.scene.enter('onramp-wizard');
});
exports.bot.hears(/\b(sell|withdraw|offramp|cashout|cash)\b/i, async (ctx) => {
    if (ctx.scene.current)
        return;
    await ctx.scene.enter('offramp-wizard');
});
exports.bot.hears(/\b(rate|rates|price|market)\b/i, async (ctx) => {
    if (ctx.scene.current)
        return;
    ctx.match = ['action_rates'];
    await handleRates(ctx);
});
exports.bot.hears(/\b(history|transactions|records|logs)\b/i, async (ctx) => {
    if (ctx.scene.current)
        return;
    await handleHistory(ctx);
});
exports.bot.hears(/\b(help|support|tutorial|faq)\b/i, async (ctx) => {
    if (ctx.scene.current)
        return;
    await handleHelp(ctx);
});
async function handleRates(ctx) {
    try {
        const rates = await switch_1.switchService.getRates();
        const msg = `
📊 <b>Current Market Rates</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Buy USDT:</b> ₦${rates.buy.toLocaleString()} / $1
💸 <b>Sell USDT:</b> ₦${rates.sell.toLocaleString()} / $1

<i>Rates are refreshed every minute.</i>
`;
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Refresh', 'action_rates')],
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    }
    catch (e) {
        await ctx.replyWithHTML('❌ Could not fetch rates. Please try again later.');
    }
}
async function handleHistory(ctx) {
    if (!ctx.from)
        return;
    try {
        const history = storage_1.storageService.getTransactionHistory(ctx.from.id, 10, 0, ['PENDING', 'COMPLETED', 'FAILED', 'VERIFIED', 'RECEIVED', 'PROCESSING']);
        if (history.length === 0) {
            await ctx.replyWithHTML(`📭 <b>No transaction history found.</b>\n\nStart your first transaction by clicking Buy or Sell!`, telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ]));
            return;
        }
        const msg = `
📜 <b>Transaction History</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select a transaction to see details:
`;
        const emojiMap = {
            'PENDING': '⏳', 'PROCESSING': '⚙️', 'COMPLETED': '✅', 'FAILED': '❌', 'EXPIRED': '⏰', 'RECEIVED': '📥', 'VERIFIED': '✨'
        };
        const buttons = history.map(tx => {
            var _a;
            const date = new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const typeLabel = tx.type === 'ONRAMP' ? 'BUY 💰' : 'SELL 💸';
            const statusEmoji = emojiMap[tx.status] || 'ℹ️';
            const assetName = ((_a = tx.asset.split(':')[1]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || tx.asset.toUpperCase();
            return [telegraf_1.Markup.button.callback(`${statusEmoji} ${typeLabel} ${tx.amount} ${assetName} • ${date}`, `status_${tx.reference}`)];
        });
        buttons.push([telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]);
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
    }
}
async function handleHelp(ctx) {
    const msg = `
❓ <b>How does Velcro work?</b>

I'm designed to be the simplest way to move between cash and crypto! 🌍

1️⃣ <b>To Buy Crypto:</b>
• Click "Buy Crypto"
• Choose what you want (e.g., USDT, USDC)
• Send cash to the provided bank account
• Receive crypto in your wallet automatically! ⚡️

2️⃣ <b>To Sell Crypto:</b>
• Click "Sell Crypto"
• Tell me how much you want to sell
• Provide your bank details (I'll remember them for next time! 🧠)
• Send the crypto to the address I show you
• Get cash in your bank account instantly! 💸

<b>Need human help?</b>
Just join our community group at <a href="https://t.me/usevelcro">@usevelcro</a> and our team will sort you out! 🌍🤝
`;
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
}
exports.bot.command('onramp', async (ctx) => {
    await (0, index_1.safeDelete)(ctx);
    await ctx.scene.enter('onramp-wizard');
});
exports.bot.command('offramp', async (ctx) => {
    await (0, index_1.safeDelete)(ctx);
    await ctx.scene.enter('offramp-wizard');
});
exports.bot.command('help', async (ctx) => {
    var _a;
    await (0, index_1.safeDelete)(ctx);
    const name = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Friend';
    return ctx.replyWithHTML(getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
});
exports.bot.catch((err, ctx) => {
    logger_1.default.error(`Bot Error (${ctx.updateType}): ${err.message}`);
    if (err.stack)
        logger_1.default.debug(err.stack);
});
async function startBot() {
    logger_1.default.info('🚀 Velcro UX 2026 Engine Starting...');
    const tryConnect = async () => {
        try {
            logger_1.default.info('📡 Testing connection to Telegram...');
            const me = await exports.bot.telegram.getMe().catch(() => null);
            if (!me) {
                logger_1.default.warn('⚠️ Warning: Could not reach Telegram API.');
                logger_1.default.info('💡 Tip: Check VPN or Proxy settings.');
                return false;
            }
            logger_1.default.info(`✅ Connected as @${me.username}`);
            return true;
        }
        catch (e) {
            logger_1.default.error(`Connection test failed: ${e.message}`);
            return false;
        }
    };
    const attemptLaunch = async () => {
        logger_1.default.info('📡 Attempting to launch bot...');
        try {
            await exports.bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => { });
            logger_1.default.info('✨ Velcro is LIVE!');
            await exports.bot.launch({ allowedUpdates: ['message', 'callback_query'] });
        }
        catch (err) {
            logger_1.default.error(`❌ Launch failed: ${err.message}`);
            logger_1.default.info('🔄 Retrying in 10 seconds...');
            setTimeout(attemptLaunch, 10000);
        }
    };
    const connected = await tryConnect();
    if (connected) {
        await attemptLaunch();
    }
    else {
        logger_1.default.info('⏳ Waiting for connection... (Retrying in 10s)');
        setTimeout(startBot, 10000);
    }
}
const handleShutdown = (signal) => {
    logger_1.default.info(`Received ${signal}. Shutting down...`);
    try {
        exports.bot.stop(signal);
    }
    catch (e) { }
    process.exit(0);
};
process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    logger_1.default.error('❌ UNCAUGHT EXCEPTION:');
    logger_1.default.error(err.message);
    logger_1.default.error(err.stack || '');
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('❌ UNHANDLED REJECTION:');
    logger_1.default.error(reason);
});
//# sourceMappingURL=index.js.map