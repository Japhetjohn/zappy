import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';

// Helper to format numbers nicely
const formatAmount = (num: number): string => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
};

const onrampWizard = new Scenes.WizardScene(
    'onramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Welcome & Asset Selection
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = {};

        const msg = `
💰 *Buy Crypto*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the crypto you want to buy:
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [
                Markup.button.callback('USDC (Base)', 'base:usdc'),
                Markup.button.callback('USDC (ETH)', 'ethereum:usdc')
            ],
            [
                Markup.button.callback('USDT (Tron)', 'tron:usdt'),
                Markup.button.callback('USDT (BEP20)', 'bsc:usdt')
            ],
            [Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 2: Country Selection
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*\n\nUse /start to begin again.');
                return ctx.scene.leave();
            }
            ctx.wizard.state.data.asset = data;
            const assetName = data.split(':')[1].toUpperCase();
            ctx.wizard.state.data.assetName = assetName;
            await ctx.answerCbQuery(`Selected ${assetName}`);
        } else {
            return;
        }

        const msg = `
🌍 *Select Country*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: *${ctx.wizard.state.data.assetName}*

Choose your country:
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('🇳🇬 Nigeria', 'NG')],
            [Markup.button.callback('🇬🇭 Ghana (Coming Soon)', 'soon')],
            [Markup.button.callback('🇰🇪 Kenya (Coming Soon)', 'soon')],
            [Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 3: Amount Input
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }
            if (data === 'soon') {
                await ctx.answerCbQuery('Coming soon! Only Nigeria is available now.');
                return;
            }
            ctx.wizard.state.data.country = data;
            ctx.wizard.state.data.currency = 'NGN';
            ctx.wizard.state.data.currencySymbol = '₦';
            await ctx.answerCbQuery('Nigeria selected');
        }

        const msg = `
💵 *Enter Amount*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: *${ctx.wizard.state.data.assetName}*
Country: *🇳🇬 Nigeria*
Currency: *NGN (₦)*

Enter the amount in Naira you want to spend:

_Example: 50000_
`;
        await ctx.replyWithMarkdown(msg);
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 4: Show Quote
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        const text = ctx.message?.text;
        if (!text || isNaN(parseFloat(text.replace(/,/g, '')))) {
            await ctx.replyWithMarkdown('⚠️ Please enter a valid number.\n\n_Example: 50000_');
            return;
        }

        const amount = parseFloat(text.replace(/,/g, ''));
        if (amount < 1000) {
            await ctx.replyWithMarkdown('⚠️ Minimum amount is ₦1,000');
            return;
        }

        ctx.wizard.state.data.amount = amount;

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching best rates..._');

            const quote = await switchService.getOnrampQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 *Quote Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 *You Pay:* ₦${formatAmount(quote.source.amount)}

💰 *You Get:* ${formatAmount(quote.destination.amount)} ${ctx.wizard.state.data.assetName}

📈 *Rate:* 1 ${ctx.wizard.state.data.assetName} = ₦${formatAmount(quote.rate)}

💳 *Fee:* ₦${formatAmount(quote.fee.total)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ _Quote expires in 5 minutes_

Proceed with this transaction?
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm & Continue', 'proceed')],
                [Markup.button.callback('🔄 Get New Quote', 'refresh')],
                [Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return ctx.wizard.next();

        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* ${error.message}\n\nPlease try again with /onramp`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 5: Wallet Address
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }
            if (data === 'refresh') {
                await ctx.answerCbQuery('Please enter amount again');
                ctx.wizard.selectStep(2);
                await ctx.replyWithMarkdown('💵 Enter amount in Naira:');
                return;
            }
            await ctx.answerCbQuery('Quote confirmed!');
        }

        const chain = ctx.wizard.state.data.asset.split(':')[0];
        const chainName = chain === 'base' ? 'Base' : chain === 'ethereum' ? 'Ethereum' : chain === 'tron' ? 'Tron' : 'BSC';

        const msg = `
📬 *Enter Wallet Address*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your ${ctx.wizard.state.data.assetName} will be sent to this address.

⚠️ *Important:* Make sure this is a *${chainName}* wallet address!

Paste your wallet address below:
`;
        await ctx.replyWithMarkdown(msg);
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 6: Complete Transaction
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        const walletAddress = ctx.message?.text?.trim();
        if (!walletAddress || walletAddress.length < 20) {
            await ctx.replyWithMarkdown('⚠️ Please enter a valid wallet address.');
            return;
        }

        ctx.wizard.state.data.walletAddress = walletAddress;

        try {
            await ctx.replyWithMarkdown('⏳ _Processing your order..._');

            const result = await switchService.initiateOnramp({
                amount: ctx.wizard.state.data.amount,
                country: ctx.wizard.state.data.country,
                asset: ctx.wizard.state.data.asset,
                walletAddress: walletAddress,
                currency: ctx.wizard.state.data.currency
            });

            const msg = `
✅ *Order Created Successfully!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Reference:* \`${result.reference}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏦 *Make Payment To:*

Bank: *${result.deposit.bank_name}*
Account: \`${result.deposit.account_number}\`
Name: *${result.deposit.account_name}*
Amount: *₦${formatAmount(ctx.wizard.state.data.amount)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Important:*
• Transfer the *exact amount* shown above
• Use the reference as payment narration
• Your crypto will be sent automatically after confirmation

━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Thank you for using Zappy! ⚡️_
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ]));
            return ctx.scene.leave();

        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* ${error.message}`);
            return ctx.scene.leave();
        }
    }
);

export { onrampWizard };
