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

export const bot = new Telegraf<BotContext>(config.botToken, {
    handlerTimeout: 90_000,
    telegram: {
        agent: config.telegramProxy ? new HttpsProxyAgent(config.telegramProxy) : undefined,
    }
});

const stage = new Scenes.Stage<BotContext>([onrampWizard, offrampWizard]);
bot.use(session());
bot.use(stage.middleware());

// Visual Helpers
// Visual Helpers
const getWelcomeMsg = (name: string) => `
Hello ${name} 👋

My name is <b>Bitnova Africa</b>, your friendly crypto assistant! 🤖✨

I'm here to make buying and selling crypto super easy, fast, and secure for you. Whether you want to turn cash into crypto or crypto into cash, I've got you covered! 🚀

<b>Here is what I can do for you:</b>
💰 <b>Buy Crypto:</b> Get crypto sent directly to your wallet.
💸 <b>Sell Crypto:</b> Turn your crypto into cash in your bank account.

<i>Ready to get started? Tap a button below!</i> 👇
`;

import { MAIN_KEYBOARD } from './keyboards';

// ═══════════════════════════════════════════════════════════
// 🏠 START COMMAND
// ═══════════════════════════════════════════════════════════
bot.command('start', async (ctx) => {
    if (ctx.from) {
        storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown');
    }
    const name = ctx.from?.first_name || 'Friend';
    return ctx.replyWithHTML(getWelcomeMsg(name), MAIN_KEYBOARD);
});

// ═══════════════════════════════════════════════════════════
// 📌 ACTION HANDLERS
// ═══════════════════════════════════════════════════════════
bot.action('action_menu', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    const name = ctx.from?.first_name || 'Friend';
    await ctx.replyWithHTML(getWelcomeMsg(name), MAIN_KEYBOARD);
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

    await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});

bot.action('action_rates', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Fetching rates...').catch(() => { });

    try {
        const rates = await switchService.getRates();
        const msg = `
📊 <b>Current Market Rates</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 <b>Buy USDT:</b> ₦${rates.buy.toLocaleString()} / $1
💸 <b>Sell USDT:</b> ₦${rates.sell.toLocaleString()} / $1

<i>Rates are refreshed every minute.</i>
`;
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh', 'action_rates')],
            [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    } catch (e) {
        await ctx.replyWithHTML('❌ Could not fetch rates. Please try again later.');
    }
});

bot.action('action_help', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
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
    await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});

bot.action('action_history', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Fetching history...').catch(() => { });
    if (!ctx.from) return;

    try {
        const history = storageService.getTransactionHistory(ctx.from.id, 10, 0);
        if (history.length === 0) {
            await safeEdit(ctx, `📭 <b>No transaction history found.</b>\n\nStart your first transaction by clicking Buy or Sell!`, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ]));
            return;
        }

        const msg = `
📜 <b>Transaction History</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select a transaction to see details:
`;

        const emojiMap: Record<string, string> = {
            'PENDING': '⏳', 'PROCESSING': '⚙️', 'COMPLETED': '✅', 'FAILED': '❌', 'EXPIRED': '⏰', 'RECEIVED': '📥', 'VERIFIED': '✨'
        };

        const buttons = history.map(tx => {
            const date = new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const typeEmoji = tx.type === 'ONRAMP' ? '💰' : '💸';
            const statusEmoji = emojiMap[tx.status] || 'ℹ️';
            // asset is like 'ethereum:usdt'
            const assetName = tx.asset.split(':')[1]?.toUpperCase() || tx.asset.toUpperCase();
            return [Markup.button.callback(`${statusEmoji} ${typeEmoji} ${tx.amount} ${assetName} • ${date}`, `status_${tx.reference}`)];
        });

        buttons.push([Markup.button.callback('🏠 Back to Menu', 'action_menu')]);

        await safeEdit(ctx, msg, Markup.inlineKeyboard(buttons));
    } catch (error: any) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
    }
});

// Dynamic status checker
bot.action(/^status_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery) await ctx.answerCbQuery('Updating...').catch(() => { });
    try {
        const status = await switchService.getStatus(reference);
        const transaction = storageService.getTransaction(reference);

        // Sync status in DB
        if (transaction && transaction.status !== status.status) {
            storageService.updateTransactionStatus(reference, status.status);
        }

        const msg = formatStatusMessage(status);
        await safeEdit(ctx, msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh', `status_${reference}`)],
            [Markup.button.callback('📜 Back to History', 'action_history')],
            [Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    } catch (e) {
        await ctx.replyWithHTML('❌ Could not fetch transaction details.');
    }
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
    const name = ctx.from?.first_name || 'Friend';
    await safeEdit(ctx, getWelcomeMsg(name), MAIN_KEYBOARD);
});

function formatStatusMessage(status: any) {
    const emojiMap: Record<string, string> = {
        'PENDING': '⏳', 'PROCESSING': '⚙️', 'COMPLETED': '✅', 'FAILED': '❌', 'EXPIRED': '⏰', 'RECEIVED': '📥', 'VERIFIED': '✨'
    };
    const emoji = emojiMap[status.status] || 'ℹ️';

    return `
${emoji} <b>Transaction Status</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Ref:</b> <code>${status.reference}</code>
🚦 <b>Status:</b> <b>${status.status}</b>

💰 <b>You Sent/Requested:</b> ${formatAmount(status.source.amount)} ${status.source.currency}
💵 <b>Estimated Payout:</b> ${formatAmount(status.destination.amount)} ${status.destination.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Updated: ${new Date().toLocaleTimeString()}</i>
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
    const name = ctx.from?.first_name || 'Friend';
    return ctx.replyWithHTML(getWelcomeMsg(name), MAIN_KEYBOARD);
});

// Error Handler
bot.catch((err: any, ctx: Context) => {
    logger.error(`Bot Error (${ctx.updateType}): ${err.message}`);
    if (err.stack) logger.debug(err.stack);
});

// Start Bot
export async function startBot() {
    logger.info('🚀 Bitnova Africa UX 2026 Engine Starting...');

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
            logger.info('✨ Bitnova Africa is LIVE!');
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
