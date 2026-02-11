import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { storageService } from '../../services/storage';
import { formatAmount, safeEdit, safeDelete, formatButtons21, paginationKeyboard, sortBanksByPriority } from '../../utils';
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
⚡️ <b>Platform Fee:</b> 0.1%

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Expires in 5 minutes</i>
`;
            await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm & Continue', 'proceed')],
                [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return ctx.wizard.next();

        } catch (error: any) {
            // Make error messages user-friendly
            let userMessage = error.message;

            if (userMessage.includes('Minimum amount')) {
                userMessage = `⚠️ The minimum purchase is <b>1 ${ctx.wizard.state.data.symbol}</b>.\n\nPlease enter a larger amount.`;
            } else if (userMessage.includes('Maximum amount')) {
                userMessage = `⚠️ This amount exceeds the maximum limit.\n\nPlease enter a smaller amount.`;
            } else {
                userMessage = `⚠️ Unable to process this amount right now.\n\n<i>${userMessage}</i>`;
            }

            const errorMsg = `
❌ <b>Quote Error</b>

${userMessage}
            `;

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
    // Step 7: Review & Confirm (Was Step 9)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

            if (data === 'cancel') return ctx.scene.leave();

            if (data === 'back') {
                ctx.wizard.selectStep(5); // Back to Wallet Address
                return ctx.wizard.steps[5](ctx);
            }
            if (data === 'initiate') {
                ctx.wizard.next();
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            }
        }

        // Skip modification of message text if not a new message (to prevent errors)
        const msg = `
✅ <b>Confirm Order</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💸 <b>Buying:</b> ${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}
💰 <b>Receiving:</b> ${formatAmount(ctx.wizard.state.quote.destination.amount)} ${ctx.wizard.state.data.symbol}

📍 <b>Wallet Address:</b>
<code>${ctx.wizard.state.data.walletAddress}</code>

Network: <b>${ctx.wizard.state.data.asset.blockchain.name}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Is this correct?
`;
        const buttons = [
            [Markup.button.callback('✅ Yes, Create Order', 'initiate')],
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
        ];
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    },

    // ═══════════════════════════════════════════════════════════
    // Step 8: Order Creation (Was Step 10)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
            if (ctx.callbackQuery.data === 'cancel') return ctx.scene.leave();
        }

        const walletAddress = ctx.wizard.state.data.walletAddress;

        try {
            const statusMsg = await ctx.replyWithHTML('⏳ <i>Creating order...</i>');

            const result = await switchService.initiateOnramp({
                amount: ctx.wizard.state.data.amount,
                country: ctx.wizard.state.data.country,
                asset: ctx.wizard.state.data.asset.id,
                walletAddress: walletAddress,
                holderName: 'Crypto Buyer',
                currency: ctx.wizard.state.data.currency,
            });

            // Save transaction to local database
            storageService.addTransaction(
                ctx.from.id,
                result.reference,
                'ONRAMP',
                ctx.wizard.state.data.asset.id,
                ctx.wizard.state.data.amount
            );

            const msg = `
✅ <b>Order Created!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Reference:</b> <code>${result.reference}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ <b>Transfer Instructions:</b>

Please make a transfer from <b>your bank account</b> directly to the account below:

🏦 <b>Destination Bank:</b> ${result.deposit.bank_name}
🔢 <b>Account Number:</b> <code>${result.deposit.account_number}</code>
👤 <b>Account Name:</b> <b>${result.deposit.account_name}</b>
💰 <b>Amount:</b> <b>${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}</b>

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
            // Make error messages user-friendly
            let userMessage = error.message;

            if (userMessage.includes('Name can only contain')) {
                userMessage = `⚠️ <b>Invalid Wallet Address</b>\n\nThe address you entered appears to be invalid for the <b>${ctx.wizard.state.data.asset.blockchain.name}</b> network.\n\nPlease double-check and try again.`;
            } else if (userMessage.includes('Invalid wallet address')) {
                userMessage = `⚠️ <b>Invalid Wallet Address</b>\n\nPlease enter a valid <b>${ctx.wizard.state.data.symbol}</b> wallet address.`;
            } else {
                userMessage = `⚠️ <b>Unable to Create Order</b>\n\n<i>${userMessage}</i>\n\nPlease try again or contact support.`;
            }

            await ctx.replyWithHTML(`❌ ${userMessage}`, Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Try Again', 'back'), Markup.button.callback('🏠 Main Menu', 'cancel')]
            ]));
            return ctx.scene.leave();
        }
    }
);

export { onrampWizard };
