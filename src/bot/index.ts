import { Telegraf, Context, session, Scenes, Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from '../config';
import { SessionData, Beneficiary } from '../types';
import { onrampWizard } from './scenes/onramp';
import { offrampWizard } from './scenes/offramp';
import { storageService } from '../services/storage';
import { switchService } from '../services/switch';
import { formatAmount } from '../utils/index';

interface BotContext extends Scenes.WizardContext {
    session: Scenes.WizardSession & SessionData;
}

const bot = new Telegraf<BotContext>(config.botToken, {
    handlerTimeout: 90_000, // 90 seconds
    telegram: {
        agent: config.telegramProxy ? new HttpsProxyAgent(config.telegramProxy) : undefined,
    }
});
const stage = new Scenes.Stage<BotContext>([onrampWizard, offrampWizard]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Logging
bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    console.log(`[${new Date().toISOString()}] ${ctx.updateType} - ${Date.now() - start}ms`);
});

// ═══════════════════════════════════════════════════════════
// 🏠 START COMMAND - Main Menu
// ═══════════════════════════════════════════════════════════
bot.command('start', async (ctx) => {
    if (ctx.from) {
        storageService.upsertUser(ctx.from.id, ctx.from.username || 'unknown');
    }

    const msg = `
⚡️ *Welcome to Zappy Bot* ⚡️

━━━━━━━━━━━━━━━━━━━━━━━━━━━

The fastest and most reliable way to buy and sell crypto locally.

🚀 *What would you like to do?*
`;
    return ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
        [
            Markup.button.callback('💰 Buy Crypto (On-ramp)', 'action_onramp'),
            Markup.button.callback('💸 Sell Crypto (Off-ramp)', 'action_offramp')
        ],
        [
            Markup.button.callback('🏦 Saved Beneficiaries', 'action_beneficiaries'),
            Markup.button.callback('📊 Last Transaction', 'status')
        ],
        [
            Markup.button.callback('📖 Help & Info', 'action_help')
        ]
    ]));
});

// ═══════════════════════════════════════════════════════════
// 📌 ACTION HANDLERS
// ═══════════════════════════════════════════════════════════
bot.action('action_onramp', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('onramp-wizard');
});

bot.action('action_offramp', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('offramp-wizard');
});

bot.action('action_beneficiaries', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from) return;

    const beneficiaries = storageService.getBeneficiaries(ctx.from.id);

    if (beneficiaries.length === 0) {
        const msg = `
📂 * Saved Accounts *

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_No saved accounts yet._

Your bank accounts will be saved automatically when you complete a withdrawal.

💡 * Tip:* Start with /offramp to add your first account!
        `;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('💸  Sell Crypto Now', 'action_offramp')],
            [Markup.button.callback('🏠  Back to Menu', 'action_menu')]
        ]));
        return;
    }

    let listMsg = `
📂 * Saved Accounts *

━━━━━━━━━━━━━━━━━━━━━━━━━━━

    `;

    beneficiaries.forEach((b: Beneficiary, i: number) => {
        listMsg += `${i + 1}. *${b.holderName}*\n`;
        listMsg += `   🏦 ${b.bankName || 'Bank'}\n`;
        listMsg += `   💳 \`${b.accountNumber}\`\n\n`;
    });

    listMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n_These accounts can be used for withdrawals._`;

    await ctx.replyWithMarkdown(listMsg, Markup.inlineKeyboard([
        [Markup.button.callback('💸 Sell Crypto Now', 'action_offramp')],
        [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
    ]));
});

bot.action('action_help', async (ctx) => {
    await ctx.answerCbQuery();
    const helpMsg = `
❓ *Help & Commands*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Available Commands:*

/start → Main menu
/onramp → Buy crypto with fiat
/offramp → Sell crypto for fiat
/beneficiaries → View saved accounts
/status → Check last transaction status
/help → Show this message

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*How it works:*

💰 *Buying Crypto:*
1. Select the crypto you want
2. Enter amount in your currency
3. Get instant rates
4. Make bank transfer
5. Receive crypto in your wallet!

💸 *Selling Crypto:*
1. Select crypto to sell
2. Enter amount
3. Choose bank account
4. Send crypto to deposit address
5. Receive cash in your bank!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Need more help? Contact support._
`;
    await ctx.replyWithMarkdown(helpMsg, Markup.inlineKeyboard([
        [Markup.button.callback('🏠  Back to Menu', 'action_menu')]
    ]));
});

bot.action('action_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => { });

    const msg = `
⚡️ *Zappy Menu*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_What would you like to do?_
`;
    await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
        [
            Markup.button.callback('💰 Buy Crypto (On-ramp)', 'action_onramp'),
            Markup.button.callback('💸 Sell Crypto (Off-ramp)', 'action_offramp')
        ],
        [
            Markup.button.callback('🏦 Saved Beneficiaries', 'action_beneficiaries'),
            Markup.button.callback('📊 Last Transaction', 'status')
        ],
        [
            Markup.button.callback('📖 Help & Info', 'action_help')
        ]
    ]));
});

// ═══════════════════════════════════════════════════════════
// 📝 TEXT COMMAND ALIASES
// ═══════════════════════════════════════════════════════════
bot.command('onramp', (ctx) => ctx.scene.enter('onramp-wizard'));
bot.command('offramp', (ctx) => ctx.scene.enter('offramp-wizard'));
bot.command('beneficiaries', async (ctx) => {
    if (!ctx.from) return;
    const beneficiaries = storageService.getBeneficiaries(ctx.from.id);

    if (beneficiaries.length === 0) {
        await ctx.replyWithMarkdown('📂 *No saved accounts yet.*\n\nUse /offramp to add one!');
        return;
    }

    let msg = '📂 *Your Saved Accounts:*\n\n';
    beneficiaries.forEach((b: Beneficiary, i: number) => {
        msg += `*${i + 1}.* ${b.holderName}\n   🏦 ${b.bankName} • \`${b.accountNumber}\`\n\n`;
    });
    await ctx.replyWithMarkdown(msg);
});

bot.command('status', async (ctx) => {
    if (!ctx.from) return;
    const userId = ctx.from.id;
    const history = storageService.getTransactionHistory(userId);

    if (history.length === 0) {
        await ctx.replyWithMarkdown('📭 *No transaction history found.*');
        return;
    }

    const last = history[history.length - 1];
    await ctx.replyWithMarkdown(`⏳ _Checking status for your last transaction (${last.reference})..._`);

    try {
        const status = await switchService.getStatus(last.reference);
        const msg = formatStatusMessage(status);
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh Status', `status_${last.reference}`)],
            [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
        ]));
    } catch (error: any) {
        await ctx.replyWithMarkdown(`❌ *Error fetching status:* ${error.message}`);
    }
});

// Action Handlers for Status and Confirmation
bot.action(/^status_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    await ctx.answerCbQuery('Checking status...');

    try {
        const status = await switchService.getStatus(reference);
        const msg = formatStatusMessage(status);
        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Refresh Status', `status_${reference}`)],
                [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ])
        });
    } catch (error: any) {
        await ctx.editMessageText(`❌ *Error:* ${error.message}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ])
        });
    }
});

bot.action(/^confirm_(.+)$/, async (ctx) => {
    const reference = ctx.match[1];
    await ctx.answerCbQuery('Confirming payment...');

    try {
        await switchService.confirmDeposit(reference);
        await ctx.replyWithMarkdown(`✅ *Payment Confirmation Sent!*\n\nReference: \`${reference}\`\n\nWe are now verifying your payment. Click the button below to check status.`, Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Check Status', `status_${reference}`)]
        ]));
    } catch (error: any) {
        await ctx.replyWithMarkdown(`❌ *Confirmation Failed:* ${error.message}`);
    }
});

function formatStatusMessage(status: any) {
    const emojiMap: Record<string, string> = {
        'PENDING': '⏳',
        'AWAITING_DEPOSIT': '🏦',
        'PROCESSING': '⚙️',
        'COMPLETED': '✅',
        'FAILED': '❌',
        'CANCELLED': '🚫'
    };

    const emoji = emojiMap[status.status] || 'ℹ️';

    let msg = `
${emoji} *Transaction Status*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Reference:* \`${status.reference}\`
🚦 *Status:* *${status.status}*
📅 *Date:* ${new Date(status.created_at).toLocaleString()}

💰 *Type:* ${status.type}
💵 *Amount:* ${status.source.amount} ${status.source.currency}
🎁 *Destination:* ${status.destination.amount} ${status.destination.currency}

`;

    if (status.status === 'COMPLETED') {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎉 *Success!* Your transaction has been completed.`;
    } else if (status.status === 'FAILED') {
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❌ *Failed:* ${status.failure_reason || 'Unknown error'}`;
    }

    return msg;
}

bot.command('help', (ctx) => {
    ctx.replyWithMarkdown(`
❓ *Quick Commands*

/start → Main menu
/onramp → Buy crypto
/offramp → Sell crypto
/beneficiaries → Saved accounts
/status → Last transaction status
`);
});

// Error Handler
bot.catch((err: any, ctx: Context) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

// Start Bot
export async function startBot() {
    console.log('🚀 Starting Zappy Bot...');

    const tryConnect = async () => {
        try {
            console.log('📡 Testing connection to Telegram...');
            const me = await bot.telegram.getMe().catch(() => null);
            if (!me) {
                console.warn('⚠️  Warning: Could not reach Telegram API.');
                console.log('💡 Tip: If you are in a restricted region:');
                console.log('   1. Connect to a VPN.');
                console.log('   2. Or use a proxy in .env (TELEGRAM_PROXY=http://ip:port)');
                console.log('   3. Or try: proxychains npm run dev');
                return false;
            }
            console.log(`✅ Connected as @${me.username}`);
            return true;
        } catch (e) {
            return false;
        }
    };

    const attemptLaunch = async () => {
        console.log('📡 Attempting to launch bot...');
        try {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => { });

            await bot.launch({
                allowedUpdates: ['message', 'callback_query'],
            });
            console.log('✨ Zappy Bot is LIVE!');
        } catch (err: any) {
            console.error('❌ Launch failed:', err.message || err);
            console.log('🔄 Retrying in 10 seconds...');
            setTimeout(attemptLaunch, 10000);
        }
    };

    const connected = await tryConnect();
    if (connected) {
        await attemptLaunch();
    } else {
        console.log('⏳ Waiting for connection... (Retrying in 10s)');
        setTimeout(startBot, 10000);
        return;
    }

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
