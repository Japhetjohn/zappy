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
exports.bot.use(stage.middleware());
const getWelcomeMsg = (name) => `
Hello ${name} 👋

My name is <b>Bitnova Africa</b>, your friendly crypto assistant! 🤖✨

I'm here to make buying and selling crypto super easy, fast, and secure for you. Whether you want to turn cash into crypto or crypto into cash, I've got you covered! 🚀

<b>Here is what I can do for you:</b>
💰 <b>Buy Crypto:</b> Get crypto sent directly to your wallet.
💸 <b>Sell Crypto:</b> Turn your crypto into cash in your bank account.

<i>Ready to get started? Tap a button below!</i> 👇
`;
const keyboards_1 = require("./keyboards");
exports.bot.command('start', async (ctx) => {
    var _a, _b;
    const name = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Friend';
    const msg = getWelcomeMsg(name);
    if (ctx.from) {
        try {
            storage_1.storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown', `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim());
        }
        catch (err) {
            logger_1.default.error(`Failed to register user ${(_b = ctx.from) === null || _b === void 0 ? void 0 : _b.id}: ${err.message}`);
        }
    }
    return ctx.replyWithHTML(msg, keyboards_1.MAIN_KEYBOARD);
});
exports.bot.command('stats', async (ctx) => {
    const stats = storage_1.storageService.getStats();
    const msg = `
📊 <b>Bitnova Africa Platform Stats</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 <b>Total Users:</b> ${stats.totalUsers.toLocaleString()}
📝 <b>Total Transactions:</b> ${stats.totalTransactions.toLocaleString()}
✅ <b>Successful Transfers:</b> ${stats.successfulTxs.toLocaleString()}
💰 <b>Total Volume:</b> $${stats.totalVolume.toLocaleString()}

<i>Scale: Ready for 20k+ users/day</i> 🌍⚡️
`;
    await ctx.replyWithHTML(msg);
});
exports.bot.action('action_menu', async (ctx) => {
    var _a;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    const name = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Friend';
    await ctx.replyWithHTML(getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
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
        const msg = formatStatusMessage(status);
        await (0, index_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Refresh', `status_${reference}`)],
            [telegraf_1.Markup.button.callback('📜 Back to History', 'action_history')],
            [telegraf_1.Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    }
    catch (e) {
        await ctx.replyWithHTML('❌ Could not fetch transaction details.');
    }
});
exports.bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Notifying system...').catch(() => { });
    try {
        await switch_1.switchService.confirmDeposit(reference);
        await (0, index_1.safeEdit)(ctx, `✅ <b>Payment Notified</b>\n\nReference: <code>${reference}</code>\n\nWe are now verifying your transfer.`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔍 Check Status', `status_${reference}`)],
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
    catch (error) {
        await (0, index_1.safeEdit)(ctx, `❌ *Error:* ${error.message}`);
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
function formatStatusMessage(status) {
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Updated: ${new Date().toLocaleTimeString()}</i>
`;
}
exports.bot.hears(/\b(hi|hello|hey|yo|start|menu|home|start)\b/i, async (ctx) => {
    var _a;
    if (ctx.scene.current)
        return;
    const name = ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Friend';
    return ctx.replyWithHTML(getWelcomeMsg(name), keyboards_1.MAIN_KEYBOARD);
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
            const typeEmoji = tx.type === 'ONRAMP' ? '💰' : '💸';
            const statusEmoji = emojiMap[tx.status] || 'ℹ️';
            const assetName = ((_a = tx.asset.split(':')[1]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || tx.asset.toUpperCase();
            return [telegraf_1.Markup.button.callback(`${statusEmoji} ${typeEmoji} ${tx.amount} ${assetName} • ${date}`, `status_${tx.reference}`)];
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
❓ <b>How does Bitnova Africa work?</b>

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
Just contact my team at <a href="https://t.me/Official_johny01">@Official_johny01</a> and they'll sort you out! 🤝
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
    logger_1.default.info('🚀 Bitnova Africa UX 2026 Engine Starting...');
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
            logger_1.default.info('✨ Bitnova Africa is LIVE!');
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
//# sourceMappingURL=index.js.map