import { Telegraf, Context, session, Scenes, Markup } from 'telegraf';
import { config } from '../config';
import { SessionData, Beneficiary } from '../types';
import { onrampWizard } from './scenes/onramp';
import { offrampWizard } from './scenes/offramp';
import { storageService } from '../services/storage';

interface BotContext extends Scenes.WizardContext {
    session: Scenes.WizardSession & SessionData;
}

const bot = new Telegraf<BotContext>(config.botToken);
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

    const welcomeMsg = `
⚡️ *Welcome to Zappy!*

Your gateway to seamless crypto transactions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *Buy Crypto* → Convert your local currency to USDC/USDT

💸 *Sell Crypto* → Convert your crypto back to local currency

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Select an option below to get started:_
`;

    await ctx.replyWithMarkdown(welcomeMsg, Markup.inlineKeyboard([
        [Markup.button.callback('💰  Buy Crypto', 'action_onramp')],
        [Markup.button.callback('💸  Sell Crypto', 'action_offramp')],
        [Markup.button.callback('📂  My Accounts', 'action_beneficiaries')],
        [Markup.button.callback('❓  Help', 'action_help')]
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
📂 *Saved Accounts*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_No saved accounts yet._

Your bank accounts will be saved automatically when you complete a withdrawal.

💡 *Tip:* Start with /offramp to add your first account!
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('💸  Sell Crypto Now', 'action_offramp')],
            [Markup.button.callback('🏠  Back to Menu', 'action_menu')]
        ]));
        return;
    }

    let listMsg = `
📂 *Saved Accounts*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

    beneficiaries.forEach((b: Beneficiary, i: number) => {
        listMsg += `*${i + 1}.* ${b.holderName}\n`;
        listMsg += `   🏦 ${b.bankName}\n`;
        listMsg += `   💳 \`${b.accountNumber}\`\n\n`;
    });

    listMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━

_These accounts can be used for withdrawals._`;

    await ctx.replyWithMarkdown(listMsg, Markup.inlineKeyboard([
        [Markup.button.callback('💸  Withdraw Now', 'action_offramp')],
        [Markup.button.callback('🏠  Back to Menu', 'action_menu')]
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

    const menuMsg = `
⚡️ *Zappy Menu*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_What would you like to do?_
`;
    await ctx.replyWithMarkdown(menuMsg, Markup.inlineKeyboard([
        [Markup.button.callback('💰  Buy Crypto', 'action_onramp')],
        [Markup.button.callback('💸  Sell Crypto', 'action_offramp')],
        [Markup.button.callback('📂  My Accounts', 'action_beneficiaries')]
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

bot.command('help', (ctx) => {
    ctx.replyWithMarkdown(`
❓ *Quick Commands*

/start → Main menu
/onramp → Buy crypto
/offramp → Sell crypto
/beneficiaries → Saved accounts
`);
});

// Error Handler
bot.catch((err: any, ctx: Context) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

// Start Bot
export async function startBot() {
    console.log('Starting Zappy Bot...');

    try {
        console.log('Clearing webhooks...');
        await bot.telegram.deleteWebhook();
        console.log('Done.');
    } catch (e) {
        console.warn('Warning: Could not clear webhook.');
    }

    console.log('Launching...');

    bot.launch({ dropPendingUpdates: true }).then(() => {
        console.log('Bot polling started.');
    }).catch((err) => {
        console.error('Launch error:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Zappy Bot is running! Send /start to your bot.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
