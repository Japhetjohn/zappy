import { Telegraf, Context, session, Scenes, Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config';
import { SessionData, Beneficiary } from '../types';
import { onrampWizard } from './scenes/onramp';
import { offrampWizard } from './scenes/offramp';
import { storageService } from '../services/storage';
import { switchService } from '../services/switch';
import { formatAmount, safeEdit, safeDelete } from '../utils/index';
import logger from '../utils/logger';

interface BotContext extends Scenes.WizardContext {
    session: Scenes.WizardSession & SessionData;
}

const bot = new Telegraf<BotContext>(config.botToken, {
    handlerTimeout: 90_000,
    telegram: {
        agent: config.telegramProxy ? new HttpsProxyAgent(config.telegramProxy) : undefined,
    }
});

const stage = new Scenes.Stage<BotContext>([onrampWizard, offrampWizard]);
bot.use(session());
bot.use(stage.middleware());

// Visual Helpers
const WELCOME_MSG = `
⚡️ <b>Zappy Finance</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Premium crypto solutions for global markets.
Secure, fast, and entirely automated.

🚀 <b>Choose an action:</b>
`;

const MAIN_KEYBOARD = Markup.inlineKeyboard([
    [
        Markup.button.callback('💰 Buy Crypto', 'action_onramp'),
        Markup.button.callback('💸 Sell Crypto', 'action_offramp')
    ],
    [
        Markup.button.callback('📂 Saved Accounts', 'action_beneficiaries'),
        Markup.button.callback('📊 Status', 'status')
    ],
    [
        Markup.button.callback('❓ Help & Info', 'action_help')
    ]
]);

// ═══════════════════════════════════════════════════════════
// 🏠 START COMMAND
// ═══════════════════════════════════════════════════════════
bot.command('start', async (ctx) => {
    if (ctx.from) {
        storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown');
    }
    await safeDelete(ctx); // Clean command
    return ctx.replyWithHTML(WELCOME_MSG, MAIN_KEYBOARD);
});

// ═══════════════════════════════════════════════════════════
// 📌 ACTION HANDLERS
// ═══════════════════════════════════════════════════════════
bot.action('action_menu', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    await safeEdit(ctx, WELCOME_MSG, MAIN_KEYBOARD);
});

bot.action('action_onramp', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('onramp-wizard');
});

bot.action('action_offramp', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.enter('offramp-wizard');
});

bot.action('action_beneficiaries', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    if (!ctx.from) return;

    const beneficiaries = storageService.getBeneficiaries(ctx.from.id);
    let msg = `
📂 <b>Saved Accounts</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    if (beneficiaries.length === 0) {
        msg += `<i>No saved accounts yet.</i>\n\nAccounts are saved automatically after your first sale.`;
    } else {
        beneficiaries.forEach((b: Beneficiary, i: number) => {
            msg += `<b>${i + 1}.</b> ${b.holderName}\n   ${b.bankName} • <code>${b.accountNumber}</code>\n\n`;
        });
    }

    await safeEdit(ctx, msg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});

bot.action('action_help', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    const msg = `
❓ <b>Help & Info</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Zappy makes crypto buy/sell simple:

💰 <b>Buying:</b> Choose asset → Pay via Transfer → Receive Crypto.
💸 <b>Selling:</b> Choose asset → Provide Bank → Send Crypto → Receive Cash.

🤝 <b>Support:</b> Contact @ZappySupport
`;
    await safeEdit(ctx, msg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});

bot.action('status', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    if (!ctx.from) return;

    const history = storageService.getTransactionHistory(ctx.from.id);
    if (history.length === 0) {
        await safeEdit(ctx, `📭 *No history found.*`, Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
        return;
    }

    const last = history[history.length - 1];
    await safeEdit(ctx, `⏳ <i>Checking status for</i> <code>${last.reference}</code>...`);

    try {
        const status = await switchService.getStatus(last.reference);
        const msg = formatStatusMessage(status);
        await safeEdit(ctx, msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh', `status_${last.reference}`)],
            [Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    } catch (error: any) {
        await safeEdit(ctx, `❌ *Error:* ${error.message}`, Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    }
});

// Dynamic status checker
bot.action(/^status_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery) await ctx.answerCbQuery('Updating...').catch(() => { });
    try {
        const status = await switchService.getStatus(reference);
        const msg = formatStatusMessage(status);
        await safeEdit(ctx, msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh', `status_${reference}`)],
            [Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    } catch (e) { }
});

bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery) await ctx.answerCbQuery('Notifying system...').catch(() => { });
    try {
        await switchService.confirmDeposit(reference);
        await safeEdit(ctx, `✅ <b>Payment Notified</b>\n\nReference: <code>${reference}</code>\n\nWe are now verifying your transfer.`, Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Check Status', `status_${reference}`)],
            [Markup.button.callback('🏠 Menu', 'action_menu')]
        ]));
    } catch (error: any) {
        await safeEdit(ctx, `❌ *Error:* ${error.message}`);
    }
});

bot.action('cancel', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    await ctx.scene.leave();
    await safeEdit(ctx, WELCOME_MSG, MAIN_KEYBOARD);
});

function formatStatusMessage(status: any) {
    const emojiMap: Record<string, string> = {
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

// Global Commands
bot.command('onramp', async (ctx) => {
    await safeDelete(ctx);
    await ctx.scene.enter('onramp-wizard');
});
bot.command('offramp', async (ctx) => {
    await safeDelete(ctx);
    await ctx.scene.enter('offramp-wizard');
});
bot.command('help', async (ctx) => {
    await safeDelete(ctx);
    return ctx.replyWithMarkdown(WELCOME_MSG, MAIN_KEYBOARD);
});

// Error Handler
bot.catch((err: any, ctx: Context) => {
    logger.error(`Bot Error (${ctx.updateType}): ${err.message}`);
    if (err.stack) logger.debug(err.stack);
});

// Start Bot
export async function startBot() {
    logger.info('🚀 Zappy UX 2026 Engine Starting...');

    const tryConnect = async () => {
        try {
            logger.info('📡 Testing connection to Telegram...');
            const me = await bot.telegram.getMe().catch(() => null);
            if (!me) {
                logger.warn('⚠️ Warning: Could not reach Telegram API.');
                logger.info('💡 Tip: Check VPN or Proxy settings.');
                return false;
            }
            logger.info(`✅ Connected as @${me.username}`);
            return true;
        } catch (e: any) {
            logger.error(`Connection test failed: ${e.message}`);
            return false;
        }
    };

    const attemptLaunch = async () => {
        logger.info('📡 Attempting to launch bot...');
        try {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => { });
            logger.info('✨ Zappy Global is LIVE!');
            await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
        } catch (err: any) {
            logger.error(`❌ Launch failed: ${err.message}`);
            logger.info('🔄 Retrying in 10 seconds...');
            setTimeout(attemptLaunch, 10000);
        }
    };

    const connected = await tryConnect();
    if (connected) {
        await attemptLaunch();
    } else {
        logger.info('⏳ Waiting for connection... (Retrying in 10s)');
        setTimeout(startBot, 10000);
    }
}

// Graceful shutdown
const handleShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);
    // Only stop if running
    try {
        bot.stop(signal);
    } catch (e) { }
    process.exit(0);
};

process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));
