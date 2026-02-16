"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onrampWizard = void 0;
const telegraf_1 = require("telegraf");
const switch_1 = require("../../services/switch");
const storage_1 = require("../../services/storage");
const utils_1 = require("../../utils");
const keyboards_1 = require("../keyboards");
const onrampWizard = new telegraf_1.Scenes.WizardScene('onramp-wizard', async (ctx) => {
    ctx.wizard.state.data = {};
    try {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        const assets = await switch_1.switchService.getAssets();
        ctx.wizard.state.assets = assets;
        const allSymbols = [...new Set(assets.map(a => a.code))];
        const priorities = ['USDT', 'USDC', 'cNG'];
        const symbols = allSymbols.sort((a, b) => {
            const idxA = priorities.indexOf(a);
            const idxB = priorities.indexOf(b);
            if (idxA !== -1 && idxB !== -1)
                return idxA - idxB;
            if (idxA !== -1)
                return -1;
            if (idxB !== -1)
                return 1;
            return a.localeCompare(b);
        });
        const msg = `
💰 <b>Buy Crypto</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the asset you want to purchase:
`;
        const buttons = symbols.map(s => telegraf_1.Markup.button.callback(s, `symbol:${s}`));
        const rows = (0, utils_1.formatButtons21)(buttons);
        rows.push([telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]);
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(rows));
        return ctx.wizard.next();
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> Failed to fetch assets. ${error.message}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data.startsWith('symbol:')) {
        const symbol = data.replace('symbol:', '');
        ctx.wizard.state.data.symbol = symbol;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery(`Selected ${symbol}`);
    }
    else {
        return;
    }
    const filteredAssets = ctx.wizard.state.assets.filter((a) => a.code === ctx.wizard.state.data.symbol);
    const msg = `
🌐 <b>Select Network</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Asset: <b>${ctx.wizard.state.data.symbol}</b>

Select the blockchain network:
`;
    const assetButtons = filteredAssets.map((a) => telegraf_1.Markup.button.callback(`🔹 ${a.blockchain.name}`, `asset:${a.id}`));
    const buttons = (0, utils_1.formatButtons21)(assetButtons);
    buttons.push([telegraf_1.Markup.button.callback('⬅️ Back', 'back_to_symbol')]);
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (data === 'back_to_symbol') {
        ctx.wizard.selectStep(0);
        return ctx.wizard.steps[0](ctx);
    }
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data.startsWith('asset:')) {
        const assetId = data.replace('asset:', '');
        const asset = ctx.wizard.state.assets.find((a) => a.id === assetId);
        ctx.wizard.state.data.asset = asset;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery(`Network: ${asset.blockchain.name}`);
    }
    else {
        return;
    }
    try {
        const coverage = await switch_1.switchService.getCoverage('ONRAMP');
        ctx.wizard.state.coverage = coverage;
        const msg = `
🌍 <b>Select Currency</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Buying: <b>${ctx.wizard.state.data.symbol}</b> (${ctx.wizard.state.data.asset.blockchain.name})

Choose your local currency:
`;
        const currencyButtons = coverage.map((c) => {
            const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
            const flag = c.country === 'NG' ? '🇳🇬' : '🌍';
            return telegraf_1.Markup.button.callback(`${flag} ${currency} (${c.country})`, `country:${c.country}:${currency}`);
        });
        const buttons = (0, utils_1.formatButtons21)(currencyButtons);
        buttons.push([telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]);
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`);
        return ctx.scene.leave();
    }
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (data === 'back') {
        ctx.wizard.selectStep(1);
        return ctx.wizard.steps[1](ctx);
    }
    if (data === 'cancel')
        return ctx.scene.leave();
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
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
    ]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (data === 'back') {
            ctx.wizard.selectStep(2);
            return ctx.wizard.steps[2](ctx);
        }
        if (data === 'cancel')
            return ctx.scene.leave();
        return;
    }
    const text = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text;
    if (!text || isNaN(parseFloat(text.replace(/,/g, '')))) {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery('⚠️ Please enter a number').catch(() => { });
        return;
    }
    const amount = parseFloat(text.replace(/,/g, ''));
    ctx.wizard.state.data.amount = amount;
    try {
        const settings = storage_1.storageService.getSettings();
        const platformFeeRaw = settings.platform_fee || '0.1';
        const platformFee = parseFloat(platformFeeRaw);
        const quote = await switch_1.switchService.getOnrampQuote(amount, ctx.wizard.state.data.country, ctx.wizard.state.data.asset.id, ctx.wizard.state.data.currency, platformFee);
        ctx.wizard.state.quote = quote;
        ctx.wizard.state.platformFee = platformFee;
        const msg = `
📊 <b>Review Quote</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 <b>You Pay:</b> ${(0, utils_1.formatAmount)(quote.source.amount)} ${ctx.wizard.state.data.currency}
💰 <b>You Get:</b> ${(0, utils_1.formatAmount)(quote.destination.amount)} ${ctx.wizard.state.data.symbol}

📈 <b>Rate:</b> 1 ${ctx.wizard.state.data.symbol} = ${(0, utils_1.formatAmount)(quote.rate)} ${ctx.wizard.state.data.currency}
${quote.fee ? `💳 <b>Fee:</b> ${(0, utils_1.formatAmount)(quote.fee.total)} ${quote.fee.currency}` : ''}
⚡️ <b>Platform Fee:</b> ${ctx.wizard.state.platformFee}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Expires in 5 minutes</i>
`;
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('✅ Confirm & Continue', 'proceed')],
            [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    }
    catch (error) {
        let userMessage = error.message;
        if (userMessage.includes('Minimum amount')) {
            userMessage = `⚠️ The minimum purchase is <b>1 ${ctx.wizard.state.data.symbol}</b>.\n\nPlease enter a larger amount.`;
        }
        else if (userMessage.includes('Maximum amount')) {
            userMessage = `⚠️ This amount exceeds the maximum limit.\n\nPlease enter a smaller amount.`;
        }
        else {
            userMessage = `⚠️ Unable to process this amount right now.\n\n<i>${userMessage}</i>`;
        }
        const errorMsg = `
❌ <b>Quote Error</b>

${userMessage}
            `;
        await ctx.replyWithHTML(errorMsg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Try Again', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return;
    }
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    if (data === 'back') {
        ctx.wizard.selectStep(3);
        return ctx.wizard.steps[3](ctx);
    }
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data !== 'proceed')
        return;
    const chainName = ctx.wizard.state.data.asset.blockchain.name;
    const msg = `
📬 <b>Wallet Address</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Where should we send your <b>${ctx.wizard.state.data.symbol}</b>?

⚠️ <b>Network:</b> ${chainName}

Paste your wallet address below:
`;
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
    ]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (data === 'cancel')
            return ctx.scene.leave();
        if (data === 'back') {
            ctx.wizard.selectStep(5);
            return ctx.wizard.steps[5](ctx);
        }
        if (data === 'initiate') {
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
        return;
    }
    const text = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text;
    if (!text) {
        return ctx.reply('⚠️ Please enter a valid wallet address.');
    }
    const trimmedAddress = text.trim();
    if (trimmedAddress.length < 20) {
        return ctx.reply('⚠️ That doesn\'t look like a valid wallet address. Please try again.');
    }
    ctx.wizard.state.data.walletAddress = trimmedAddress;
    const msg = `
✅ <b>Confirm Order</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💸 <b>Buying:</b> ${(0, utils_1.formatAmount)(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}
💰 <b>Receiving:</b> ${(0, utils_1.formatAmount)(ctx.wizard.state.quote.destination.amount)} ${ctx.wizard.state.data.symbol}

📍 <b>Wallet Address:</b>
<code>${ctx.wizard.state.data.walletAddress}</code>

Network: <b>${ctx.wizard.state.data.asset.blockchain.name}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Is this correct?
`;
    const buttons = [
        [telegraf_1.Markup.button.callback('✅ Yes, Create Order', 'initiate')],
        [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
    ];
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery) {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (ctx.callbackQuery.data === 'cancel')
            return ctx.scene.leave();
    }
    const walletAddress = ctx.wizard.state.data.walletAddress;
    try {
        const statusMsg = await ctx.replyWithHTML('⏳ <i>Creating order...</i>');
        const result = await switch_1.switchService.initiateOnramp({
            amount: ctx.wizard.state.data.amount,
            country: ctx.wizard.state.data.country,
            asset: ctx.wizard.state.data.asset.id,
            walletAddress: walletAddress,
            holderName: 'Bitnova User',
            currency: ctx.wizard.state.data.currency,
            developerFee: ctx.wizard.state.platformFee
        });
        storage_1.storageService.addTransaction({
            userId: ctx.from.id,
            reference: result.reference,
            type: 'ONRAMP',
            asset: ctx.wizard.state.data.asset.id,
            amount: ctx.wizard.state.data.amount,
            currency: ctx.wizard.state.data.currency
        });
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
💰 <b>Amount:</b> <b>${(0, utils_1.formatAmount)(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Your crypto will be sent automatically after your transfer is confirmed.</i>
`;
        const buttons = [
            [telegraf_1.Markup.button.callback('💳 I have paid', `confirm_${result.reference}`)],
            ...(((_a = keyboards_1.MAIN_KEYBOARD.reply_markup) === null || _a === void 0 ? void 0 : _a.inline_keyboard) || [])
        ];
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
        return ctx.scene.leave();
    }
    catch (error) {
        let userMessage = error.message;
        if (userMessage.includes('Name can only contain')) {
            userMessage = `⚠️ <b>Invalid Wallet Address</b>\n\nThe address you entered appears to be invalid for the <b>${ctx.wizard.state.data.asset.blockchain.name}</b> network.\n\nPlease double-check and try again.`;
        }
        else if (userMessage.includes('Invalid wallet address')) {
            userMessage = `⚠️ <b>Invalid Wallet Address</b>\n\nPlease enter a valid <b>${ctx.wizard.state.data.symbol}</b> wallet address.`;
        }
        else {
            userMessage = `⚠️ <b>Unable to Create Order</b>\n\n<i>${userMessage}</i>\n\nPlease try again or contact support.`;
        }
        await ctx.replyWithHTML(`❌ ${userMessage}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔄 Try Again', 'back'), telegraf_1.Markup.button.callback('🏠 Main Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
});
exports.onrampWizard = onrampWizard;
//# sourceMappingURL=onramp.js.map