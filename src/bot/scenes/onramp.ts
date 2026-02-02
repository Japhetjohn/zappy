import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { formatAmount } from '../../utils';

const onrampWizard = new Scenes.WizardScene(
    'onramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Asset Selection (Dynamic)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = {};
        try {
            await ctx.replyWithMarkdown('⏳ _Fetching available assets..._');
            const assets = await switchService.getAssets();
            ctx.wizard.state.assets = assets;

            // Group by blockchain
            const grouped: Record<string, any[]> = {};
            assets.forEach(a => {
                const chainName = a.blockchain.name;
                if (!grouped[chainName]) grouped[chainName] = [];
                grouped[chainName].push(a);
            });

            const msg = `
💰 *Buy Crypto*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the asset you want to buy:
`;
            const buttons = [];
            for (const [chain, chainAssets] of Object.entries(grouped)) {
                const row = chainAssets.map(a => Markup.button.callback(`${a.code} (${chain})`, `asset:${a.id}`));
                // Split into rows of 2
                for (let i = 0; i < row.length; i += 2) {
                    buttons.push(row.slice(i, i + 2));
                }
            }
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* Failed to fetch assets. ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 2: Country Selection (Dynamic)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') {
            await ctx.answerCbQuery('Cancelled');
            await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
            return ctx.scene.leave();
        }

        if (data.startsWith('asset:')) {
            const assetId = data.replace('asset:', '');
            const asset = ctx.wizard.state.assets.find((a: any) => a.id === assetId);
            ctx.wizard.state.data.asset = asset;
            await ctx.answerCbQuery(`Selected ${asset.code}`);
        } else {
            return;
        }

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching supported countries..._');
            const coverage = await switchService.getCoverage('ONRAMP');
            ctx.wizard.state.coverage = coverage;

            const msg = `
🌍 *Select Country*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: *${ctx.wizard.state.data.asset.code}* (${ctx.wizard.state.data.asset.blockchain.name})

Choose your country:
`;
            const buttons = coverage.map((c: any) => {
                const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
                return [Markup.button.callback(`${c.country === 'NG' ? '🇳🇬' : '🌍'} ${c.country}`, `country:${c.country}:${currency}`)];
            });
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* Failed to fetch countries. ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 3: Amount Input
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') {
            await ctx.answerCbQuery('Cancelled');
            await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
            return ctx.scene.leave();
        }

        if (data.startsWith('country:')) {
            const parts = data.split(':');
            ctx.wizard.state.data.country = parts[1];
            ctx.wizard.state.data.currency = parts[2];
            await ctx.answerCbQuery(`Selected ${parts[1]}`);
        }

        const msg = `
💵 *Enter Amount*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: *${ctx.wizard.state.data.asset.code}*
Country: *${ctx.wizard.state.data.country}*
Currency: *${ctx.wizard.state.data.currency}*

Enter the amount in *${ctx.wizard.state.data.currency}* you want to spend:

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
            await ctx.replyWithMarkdown(`⚠️ Please enter a valid number.\n\n_Example: 50000_`);
            return;
        }

        const amount = parseFloat(text.replace(/,/g, ''));
        ctx.wizard.state.data.amount = amount;

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching best rates..._');

            const quote = await switchService.getOnrampQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset.id,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 *Quote Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 *You Pay:* ${formatAmount(quote.source.amount)} ${quote.source.currency}

💰 *You Get:* ${formatAmount(quote.destination.amount)} ${ctx.wizard.state.data.asset.code}

📈 *Rate:* 1 ${ctx.wizard.state.data.asset.code} = ${formatAmount(quote.rate)} ${quote.source.currency}
${quote.fee ? `\n💳 *Fee:* ${formatAmount(quote.fee.total)} ${quote.fee.currency}\n` : ''}
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
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') {
            await ctx.answerCbQuery('Cancelled');
            await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
            return ctx.scene.leave();
        }
        if (data === 'refresh') {
            await ctx.answerCbQuery('Please enter amount again');
            ctx.wizard.selectStep(2);
            await ctx.replyWithMarkdown(`💵 Enter amount in ${ctx.wizard.state.data.currency}:`);
            return;
        }
        await ctx.answerCbQuery('Quote confirmed!');

        const chainName = ctx.wizard.state.data.asset.blockchain.name;

        const msg = `
📬 *Enter Wallet Address*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your *${ctx.wizard.state.data.asset.code}* will be sent to this address.

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
                asset: ctx.wizard.state.data.asset.id,
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
Amount: *${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Important:*
• Transfer the *exact amount* shown above
• Use the reference as payment narration
• Your crypto will be sent automatically after confirmation

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 _After making the transfer, click the button below to speed up confirmation._
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('💳 I have made the payment', `confirm_${result.reference}`)],
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
