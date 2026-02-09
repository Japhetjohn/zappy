import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { storageService } from '../../services/storage';
import { formatAmount, safeEdit, safeDelete, formatButtons21 } from '../../utils';
import { MAIN_KEYBOARD } from '../keyboards';

const onrampWizard = new Scenes.WizardScene(
    'onramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Symbol Selection (e.g., USDT, USDC)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = {};
        try {
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
            const assets = await switchService.getAssets();
            ctx.wizard.state.assets = assets;

            // Group by code (Symbol)
            const allSymbols = [...new Set(assets.map(a => a.code))];
            const priorities = ['USDT', 'USDC', 'cNG']; // User requested priority
            const symbols = allSymbols.sort((a, b) => {
                const idxA = priorities.indexOf(a);
                const idxB = priorities.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            const msg = `
💰 <b>Buy Crypto</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the asset you want to purchase:
`;
            const buttons = symbols.map(s => Markup.button.callback(s, `symbol:${s}`));
            const rows = formatButtons21(buttons);
            rows.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(rows));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithHTML(`❌ <b>Error:</b> Failed to fetch assets. ${error.message}`, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'cancel')]
            ]));
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 2: Network Selection
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') return ctx.scene.leave();

        if (data.startsWith('symbol:')) {
            const symbol = data.replace('symbol:', '');
            ctx.wizard.state.data.symbol = symbol;
            if (ctx.callbackQuery) await ctx.answerCbQuery(`Selected ${symbol}`);
        } else {
            return;
        }

        const filteredAssets = ctx.wizard.state.assets.filter((a: any) => a.code === ctx.wizard.state.data.symbol);

        const msg = `
🌐 <b>Select Network</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Asset: <b>${ctx.wizard.state.data.symbol}</b>

Select the blockchain network:
`;
        const assetButtons = filteredAssets.map((a: any) =>
            Markup.button.callback(`🔹 ${a.blockchain.name}`, `asset:${a.id}`)
        );
        const buttons = formatButtons21(assetButtons);
        buttons.push([Markup.button.callback('⬅️ Back', 'back_to_symbol')]);

        await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 3: Country Selection
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;

        if (data === 'back_to_symbol') {
            ctx.wizard.selectStep(0);
            return ctx.wizard.steps[0](ctx);
        }
        if (data === 'cancel') return ctx.scene.leave();

        if (data.startsWith('asset:')) {
            const assetId = data.replace('asset:', '');
            const asset = ctx.wizard.state.assets.find((a: any) => a.id === assetId);
            ctx.wizard.state.data.asset = asset;
            if (ctx.callbackQuery) await ctx.answerCbQuery(`Network: ${asset.blockchain.name}`);
        } else {
            return;
        }

        try {
            const coverage = await switchService.getCoverage('ONRAMP');
            ctx.wizard.state.coverage = coverage;

            const msg = `
🌍 <b>Select Currency</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: <b>${ctx.wizard.state.data.symbol}</b> (${ctx.wizard.state.data.asset.blockchain.name})

Choose your local currency:
`;
            const currencyButtons = coverage.map((c: any) => {
                const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
                const flag = c.country === 'NG' ? '🇳🇬' : '🌍';
                return Markup.button.callback(`${flag} ${currency} (${c.country})`, `country:${c.country}:${currency}`);
            });

            const buttons = formatButtons21(currencyButtons);
            buttons.push([Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 4: Amount Input
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;

        if (data === 'back') {
            ctx.wizard.selectStep(1); // Back to Network selection
            return ctx.wizard.steps[1](ctx);
        }
        if (data === 'cancel') return ctx.scene.leave();

        if (data.startsWith('country:')) {
            const parts = data.split(':');
            ctx.wizard.state.data.country = parts[1];
            ctx.wizard.state.data.currency = parts[2];
        }

        const msg = `
💵 <b>Enter Amount</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

How much <b>${ctx.wizard.state.data.currency}</b> would you like to spend?

<i>Example: 50,000</i>
`;
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 5: Show Quote
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

            if (data === 'back') {
                ctx.wizard.selectStep(2); // Back to Country selection
                return ctx.wizard.steps[2](ctx);
            }
            if (data === 'cancel') return ctx.scene.leave();
            return;
        }

        const text = ctx.message?.text;
        // await safeDelete(ctx); // Stop deleting user input

        if (!text || isNaN(parseFloat(text.replace(/,/g, '')))) {
            if (ctx.callbackQuery) await ctx.answerCbQuery('⚠️ Please enter a number').catch(() => { });
            return;
        }

        const amount = parseFloat(text.replace(/,/g, ''));
        ctx.wizard.state.data.amount = amount;

        try {
            const quote = await switchService.getOnrampQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset.id,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 <b>Review Quote</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 <b>You Pay:</b> ${formatAmount(quote.source.amount)} ${ctx.wizard.state.data.currency}
💰 <b>You Get:</b> ${formatAmount(quote.destination.amount)} ${ctx.wizard.state.data.symbol}

📈 <b>Rate:</b> 1 ${ctx.wizard.state.data.symbol} = ${formatAmount(quote.rate)} ${ctx.wizard.state.data.currency}
${quote.fee ? `💳 <b>Fee:</b> ${formatAmount(quote.fee.total)} ${quote.fee.currency}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Expires in 5 minutes</i>
`;
            await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm & Continue', 'proceed')],
                [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return ctx.wizard.next();

        } catch (error: any) {
            let errorMsg = error.message;
            if (errorMsg.includes('Maximum amount')) {
                errorMsg = `⚠️ <b>Limit Exceeded</b>\n\nThe maximum amount allowed per transaction is <b>10,000 ${ctx.wizard.state.data.symbol}</b>. Please enter a smaller amount.`;
            } else {
                errorMsg = `❌ <b>Error:</b> ${errorMsg}`;
            }

            await ctx.replyWithHTML(errorMsg, Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Try Again', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return;
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 6: Wallet Address Prompt
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

        if (data === 'back') {
            ctx.wizard.selectStep(3); // Back to amount entry
            return ctx.wizard.steps[3](ctx);
        }
        if (data === 'cancel') return ctx.scene.leave();
        if (data !== 'proceed') return;

        const chainName = ctx.wizard.state.data.asset.blockchain.name;

        const msg = `
📬 <b>Wallet Address</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Where should we send your <b>${ctx.wizard.state.data.symbol}</b>?

⚠️ <b>Network:</b> ${chainName}

Paste your wallet address below:
`;
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 7: Order Creation
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

            if (data === 'back') {
                ctx.wizard.selectStep(4); // Back to Quote review buttons screen
                return ctx.wizard.steps[4](ctx);
            }
            if (data === 'cancel') return ctx.scene.leave();
            return;
        }

        const walletAddress = ctx.message?.text?.trim();
        // if (walletAddress) await safeDelete(ctx); // Stop deleting

        if (!walletAddress || walletAddress.length < 20) {
            if (ctx.callbackQuery) await ctx.answerCbQuery('⚠️ Invalid wallet address').catch(() => { });
            return;
        }

        ctx.wizard.state.data.walletAddress = walletAddress;

        try {
            const statusMsg = await ctx.replyWithHTML('⏳ <i>Creating order...</i>');

            const result = await switchService.initiateOnramp({
                amount: ctx.wizard.state.data.amount,
                country: ctx.wizard.state.data.country,
                asset: ctx.wizard.state.data.asset.id,
                walletAddress: walletAddress,
                holderName: ctx.from?.first_name || ctx.from?.username || ctx.from?.id.toString(),
                currency: ctx.wizard.state.data.currency
            });

            // Save transaction to local database
            storageService.addTransaction(
                ctx.from.id,
                result.reference,
                'ONRAMP',
                ctx.wizard.state.data.asset.id, // Store asset ID (e.g., 'ethereum:usdc') for network parsing
                ctx.wizard.state.data.amount
            );

            const msg = `
✅ <b>Order Created!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Reference:</b> <code>${result.reference}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏦 <b>Make Payment:</b>

Bank: <b>${result.deposit.bank_name}</b>
Account: <code>${result.deposit.account_number}</code>
Name: <b>${result.deposit.account_name}</b>
Amount: <b>${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Your crypto will be sent automatically after your transfer is confirmed.</i>
`;

            const buttons = [
                [Markup.button.callback('💳 I have paid', `confirm_${result.reference}`)],
                ...(MAIN_KEYBOARD.reply_markup?.inline_keyboard || [])
            ];

            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
            return ctx.scene.leave();

        } catch (error: any) {
            await ctx.replyWithHTML(`❌ <b>Order Failed:</b> ${error.message}`, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'cancel')]
            ]));
            return ctx.scene.leave();
        }
    }
);

export { onrampWizard };
