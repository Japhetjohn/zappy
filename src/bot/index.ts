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

// 📝 Log All Updates
bot.use((ctx, next) => {
    const updateType = ctx.updateType;
    const from = ctx.from?.id || 'unknown';
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    logger.info(`Update: [${updateType}] from [${from}]${text ? ` text: ${text}` : ''}`);
    return next();
});

// ═══════════════════════════════════════════════════════════
// 🏠 START COMMAND ( Global Priority )
// ═══════════════════════════════════════════════════════════
bot.command('start', async (ctx) => {
    try {
        // Force clear scene state manually since we are before stage middleware
        if (ctx.session) {
            (ctx.session as any).__scenes = undefined;
        }

        logger.info(`Processing /start command for ${ctx.from?.id}`);
        const name = ctx.from?.first_name || 'Friend';
        const msg = getWelcomeMsg(name);

        // Attempt to register user in background
        if (ctx.from) {
            try {
                storageService.upsertUser(
                    ctx.from.id,
                    ctx.from.username || 'unknown',
                    `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim()
                );
            } catch (err: any) {
                logger.error(`Failed to register user ${ctx.from?.id}: ${err.message}`);
            }
        }

        await ctx.replyWithHTML(msg, MAIN_KEYBOARD);
    } catch (err: any) {
        logger.error(`Error in /start command: ${err.message}`);
        logger.error(err.stack);
        try {
            await ctx.reply('⚠️ Something went wrong. Please try again.');
        } catch (e) {
            logger.error('Failed to send error message to user');
        }
    }
});

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

// START Command moved to top for priority

// 📊 ADMIN STATS COMMAND (Restricted)
const ADMIN_USERNAMES = ['japhet', 'kamalkt6'];

bot.command('stats', async (ctx) => {
    const username = ctx.from?.username?.toLowerCase();

    if (!username || !ADMIN_USERNAMES.includes(username)) {
        await ctx.replyWithHTML(`🔒 <b>Access Denied</b>\n\nSorry, this command is for <b>Bitnova Admins</b> only.\n\nIf you need help, type /help or join our community! 🌍`);
        return;
    }

    try {
        const stats = storageService.getStats() as any;
        const fees = await switchService.getDeveloperFees();

        const msg = `
📊 <b>Bitnova Africa Platform Stats</b>

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
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('💸 Withdraw Fees', 'withdraw_fees')],
            [Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    } catch (err: any) {
        logger.error(`Error in /stats command: ${err.message}`);
        await ctx.reply('❌ Error fetching stats/fees.');
    }
});

// ═══════════════════════════════════════════════════════════
// 📌 ACTION HANDLERS
// ═══════════════════════════════════════════════════════════
bot.action('withdraw_fees', async (ctx): Promise<any> => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    const username = ctx.from?.username?.toLowerCase();
    if (!username || !ADMIN_USERNAMES.includes(username)) return;

    try {
        const fees = await switchService.getDeveloperFees();
        if (fees.amount <= 0) {
            return await ctx.reply('❌ No fees available to withdraw.');
        }

        const msg = `
💸 <b>Withdraw Developer Fees</b>

Current Balance: <b>${fees.amount} ${fees.currency}</b>

Please enter the <b>Solana Wallet Address</b> where you want to receive your USDC payout:
`;
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'action_menu')]
        ]));

        // Simple way to handle the next message as address
        // For a more robust way, use a wizard, but for admin this is fine
        (ctx.session as any).awaiting_withdraw_address = true;
        return;
    } catch (e: any) {
        return await ctx.reply(`❌ Error: ${e.message}`);
    }
});

// Add handler for withdrawal address
bot.on('text', async (ctx, next) => {
    if ((ctx.session as any).awaiting_withdraw_address) {
        const address = ctx.message.text.trim();
        if (address.length < 32) return ctx.reply('❌ Invalid wallet address. Please try again.');

        delete (ctx.session as any).awaiting_withdraw_address;

        try {
            await ctx.reply('⏳ Processing withdrawal...');
            const result = await switchService.withdrawDeveloperFees('base:usdc', address);
            await ctx.replyWithHTML(`✅ <b>Withdrawal Successful!</b>\n\nReference: <code>${result.reference}</code>\n\nFunds will arrive shortly.`);
        } catch (e: any) {
            await ctx.reply(`❌ Withdrawal Failed: ${e.message}`);
        }
        return;
    }
    return next();
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
    await handleRates(ctx);
});

bot.action('action_help', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
    await handleHelp(ctx);
});

bot.action('action_history', async (ctx) => {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Fetching history...').catch(() => { });
    await handleHistory(ctx);
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

        // Fetch latest tx data (including hash if webhook arrived)
        const updatedTx = storageService.getTransaction(reference);
        const hash = updatedTx?.hash || '';

        const msg = formatStatusMessage(status, hash);

        const redoAction = transaction?.type === 'OFFRAMP' ? 'action_offramp' : 'action_onramp';

        await safeEdit(ctx, msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh Status', `status_${reference}`)],
            [Markup.button.url('📞 Contact Support', 'https://t.me/bitnova_africa')],
            [Markup.button.callback('🔁 Redo Transaction', redoAction)],
            [Markup.button.callback('🏠 Main Menu', 'action_menu')]
        ]));
    } catch (e) {
        // User requested "Keep user mind at rest"
        await ctx.replyWithHTML('⏳ <b>Transaction Processing...</b>\n\nPlease wait a moment while we update the status from the network.');
    }
});



bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    if (ctx.callbackQuery) await ctx.answerCbQuery('Notifying system...').catch(() => { });
    try {
        await switchService.confirmDeposit(reference);
        await safeEdit(ctx, `✅ <b>Payment Notified</b>\n\nReference: <code>${reference}</code>\n\nWe are now verifying your transfer.`, Markup.inlineKeyboard([
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

function formatStatusMessage(status: any, hash?: string) {
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

${hash ? `🔗 <b>Transaction Hash:</b>\n<code>${hash}</code>` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Updated: ${new Date().toLocaleTimeString()}</i>
`;
}

// ═══════════════════════════════════════════════════════════
// 🧠 SEAMLESS KEYWORD TRIGGERS
// ═══════════════════════════════════════════════════════════

// Trigger Welcome/Menu: hi, hello, home, menu, etc.
bot.hears(/\b(hi|hello|hey|yo|start|menu|home)\b/i, async (ctx) => {
    try {
        logger.info(`Processing HEARS trigger for ${ctx.from?.id}. Scene: ${ctx.scene.current ? ctx.scene.current.id : 'none'}`);
        if (ctx.scene.current) {
            logger.info(`Returning because user is in scene: ${ctx.scene.current.id}`);
            return; // Don't interrupt active wizards
        }
        const name = ctx.from?.first_name || 'Friend';
        await ctx.replyWithHTML(getWelcomeMsg(name), MAIN_KEYBOARD);
    } catch (err: any) {
        logger.error(`Error in hears handler: ${err.message}`);
    }
});

// Trigger Buy: buy, send, onramp, deposit
bot.hears(/\b(buy|send|onramp|deposit|crypto)\b/i, async (ctx) => {
    if (ctx.scene.current) return;
    await ctx.scene.enter('onramp-wizard');
});

// Trigger Sell: sell, withdraw, offramp, cashout
bot.hears(/\b(sell|withdraw|offramp|cashout|cash)\b/i, async (ctx) => {
    if (ctx.scene.current) return;
    await ctx.scene.enter('offramp-wizard');
});

// Trigger Rates: rate, price, market
bot.hears(/\b(rate|rates|price|market)\b/i, async (ctx) => {
    if (ctx.scene.current) return;
    // Re-trigger the action logic
    ctx.match = ['action_rates'] as any;
    // Instead of duplicating logic, we can manually call the action handler if needed, 
    // but better to just trigger a re-route or define a shared function.
    // For now, let's just trigger the scene or the logic.
    await handleRates(ctx);
});

// Trigger History: history, transactions, records
bot.hears(/\b(history|transactions|records|logs)\b/i, async (ctx) => {
    if (ctx.scene.current) return;
    await handleHistory(ctx);
});

// Trigger Help: help, support, tutorial
bot.hears(/\b(help|support|tutorial|faq)\b/i, async (ctx) => {
    if (ctx.scene.current) return;
    await handleHelp(ctx);
});

// Helper functions to reuse logic
async function handleRates(ctx: any) {
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
}

async function handleHistory(ctx: any) {
    if (!ctx.from) return;
    try {
        // Filter out PENDING/EXPIRED as per request - show only meaningful history
        const history = storageService.getTransactionHistory(ctx.from.id, 10, 0, ['PENDING', 'COMPLETED', 'FAILED', 'VERIFIED', 'RECEIVED', 'PROCESSING']);
        if (history.length === 0) {
            await ctx.replyWithHTML(`📭 <b>No transaction history found.</b>\n\nStart your first transaction by clicking Buy or Sell!`, Markup.inlineKeyboard([
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
            const typeLabel = tx.type === 'ONRAMP' ? 'BUY 💰' : 'SELL 💸';
            const statusEmoji = emojiMap[tx.status] || 'ℹ️';
            const assetName = tx.asset.split(':')[1]?.toUpperCase() || tx.asset.toUpperCase();
            return [Markup.button.callback(`${statusEmoji} ${typeLabel} ${tx.amount} ${assetName} • ${date}`, `status_${tx.reference}`)];
        });

        buttons.push([Markup.button.callback('🏠 Back to Menu', 'action_menu')]);
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    } catch (error: any) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
    }
}

async function handleHelp(ctx: any) {
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
Just join our community group at <a href="https://t.me/bitnova_africa">@bitnova_africa</a> and our team will sort you out! 🌍🤝
`;
    await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
}

// ═══════════════════════════════════════════════════════════
// 🏁 START/GLOBAL COMMANDS
// ═══════════════════════════════════════════════════════════
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

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('❌ UNCAUGHT EXCEPTION:');
    logger.error(err.message);
    logger.error(err.stack || '');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ UNHANDLED REJECTION:');
    logger.error(reason);
});
