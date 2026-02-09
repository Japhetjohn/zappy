"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const bot = new telegraf_1.Telegraf(config_1.config.botToken, {
    handlerTimeout: 90000,
    telegram: {
        agent: config_1.config.telegramProxy ? new https_proxy_agent_1.HttpsProxyAgent(config_1.config.telegramProxy) : undefined,
    }
});
const stage = new telegraf_1.Scenes.Stage([onramp_1.onrampWizard, offramp_1.offrampWizard]);
bot.use((0, telegraf_1.session)());
bot.use(stage.middleware());
const WELCOME_MSG = `
⚡️ <b>Zappy Finance</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Premium crypto solutions for global markets.
Secure, fast, and entirely automated.

🚀 <b>Choose an action:</b>
`;
const MAIN_KEYBOARD = telegraf_1.Markup.inlineKeyboard([
    [
        telegraf_1.Markup.button.callback('💰 Buy Crypto', 'action_onramp'),
        telegraf_1.Markup.button.callback('💸 Sell Crypto', 'action_offramp')
    ],
    [
        telegraf_1.Markup.button.callback('📂 Saved Accounts', 'action_beneficiaries'),
        telegraf_1.Markup.button.callback('📊 Status', 'status')
    ],
    [
        telegraf_1.Markup.button.callback('❓ Help & Info', 'action_help')
    ]
]);
bot.command('start', async (ctx) => {
    if (ctx.from) {
        storage_1.storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown');
    }
    await (0, index_1.safeDelete)(ctx);
    return ctx.replyWithMarkdown(WELCOME_MSG, MAIN_KEYBOARD);
});
bot.action('action_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    await (0, index_1.safeEdit)(ctx, WELCOME_MSG, MAIN_KEYBOARD);
});
bot.action('action_onramp', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('onramp-wizard');
});
bot.action('action_offramp', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('offramp-wizard');
});
bot.action('action_beneficiaries', async (ctx) => {
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
    await (0, index_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});
bot.action('action_help', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    const msg = `
❓ <b>Help & Info</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Zappy makes crypto buy/sell simple:

💰 <b>Buying:</b> Choose asset → Pay via Transfer → Receive Crypto.
💸 <b>Selling:</b> Choose asset → Provide Bank → Send Crypto → Receive Cash.

🤝 <b>Support:</b> Contact @ZappySupport
`;
    await (0, index_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});
bot.action('status', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    if (!ctx.from)
        return;
    const history = storage_1.storageService.getTransactionHistory(ctx.from.id);
    if (history.length === 0) {
        await (0, index_1.safeEdit)(ctx, `📭 *No history found.*`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
        return;
    }
    const last = history[history.length - 1];
    await (0, index_1.safeEdit)(ctx, `⏳ <i>Checking status for</i> <code>${last.reference}</code>...`);
    try {
        const status = await switch_1.switchService.getStatus(last.reference);
        const msg = formatStatusMessage(status);
        await (0, index_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Refresh', `status_${last.reference}`)],
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
    catch (error) {
        await (0, index_1.safeEdit)(ctx, `❌ *Error:* ${error.message}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
});
bot.action(/^status_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    await ctx.answerCbQuery('Updating...').catch(() => { });
    try {
        const status = await switch_1.switchService.getStatus(reference);
        const msg = formatStatusMessage(status);
        await (0, index_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Refresh', `status_${reference}`)],
            [telegraf_1.Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
    catch (e) { }
});
bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
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
bot.action('cancel', async (ctx) => {
    await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.leave();
    await (0, index_1.safeEdit)(ctx, WELCOME_MSG, MAIN_KEYBOARD);
});
function formatStatusMessage(status) {
    const emojiMap = {
        'PENDING': '⏳', 'PROCESSING': '⚙️', 'COMPLETED': '✅', 'FAILED': '❌'
    };
    const emoji = emojiMap[status.status] || 'ℹ️';
    return `
${emoji} <b>Asset Status</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${status.reference}</code>
🚦 <b>Status:</b> <b>${status.status}</b>

💰 <b>Amount:</b> ${status.source.amount} ${status.source.currency}
🎁 <b>Receiving:</b> ${status.destination.amount} ${status.destination.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}
bot.command('onramp', async (ctx) => {
    await (0, index_1.safeDelete)(ctx);
    await ctx.scene.enter('onramp-wizard');
});
bot.command('offramp', async (ctx) => {
    await (0, index_1.safeDelete)(ctx);
    await ctx.scene.enter('offramp-wizard');
});
bot.command('help', async (ctx) => {
    await (0, index_1.safeDelete)(ctx);
    return ctx.replyWithMarkdown(WELCOME_MSG, MAIN_KEYBOARD);
});
bot.catch((err, ctx) => {
    logger_1.default.error(`Bot Error (${ctx.updateType}): ${err.message}`);
    if (err.stack)
        logger_1.default.debug(err.stack);
});
async function startBot() {
    logger_1.default.info('🚀 Zappy UX 2026 Engine Starting...');
    const tryConnect = async () => {
        try {
            logger_1.default.info('📡 Testing connection to Telegram...');
            const me = await bot.telegram.getMe().catch(() => null);
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
            await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => { });
            await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
            logger_1.default.info('✨ Zappy Global is LIVE!');
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
        bot.stop(signal);
    }
    catch (e) { }
    process.exit(0);
};
process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));
//# sourceMappingURL=index.js.map