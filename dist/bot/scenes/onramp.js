"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onrampWizard = void 0;
const telegraf_1 = require("telegraf");
const switch_1 = require("../../services/switch");
const utils_1 = require("../../utils");
const onrampWizard = new telegraf_1.Scenes.WizardScene('onramp-wizard', async (ctx) => {
    ctx.wizard.state.data = {};
    try {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        const assets = await switch_1.switchService.getAssets();
        ctx.wizard.state.assets = assets;
        const symbols = [...new Set(assets.map(a => a.code))].sort();
        const msg = `
💰 <b>Buy Crypto</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the asset you want to purchase:
`;
        const buttons = symbols.map(s => telegraf_1.Markup.button.callback(s, `symbol:${s}`));
        const rows = [];
        for (let i = 0; i < buttons.length; i += 2) {
            rows.push(buttons.slice(i, i + 2));
        }
        rows.push([telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]);
        await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard(rows));
        return ctx.wizard.next();
    }
    catch (error) {
        await (0, utils_1.safeEdit)(ctx, `❌ <b>Error:</b> Failed to fetch assets. ${error.message}`, telegraf_1.Markup.inlineKeyboard([
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
    const buttons = filteredAssets.map((a) => [
        telegraf_1.Markup.button.callback(`🔹 ${a.blockchain.name}`, `asset:${a.id}`)
    ]);
    buttons.push([telegraf_1.Markup.button.callback('⬅️ Back', 'back_to_symbol')]);
    await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard(buttons));
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
        const buttons = coverage.map((c) => {
            const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
            const flag = c.country === 'NG' ? '🇳🇬' : '🌍';
            return [telegraf_1.Markup.button.callback(`${flag} ${currency} (${c.country})`, `country:${c.country}:${currency}`)];
        });
        buttons.push([telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]);
        await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    }
    catch (error) {
        await (0, utils_1.safeEdit)(ctx, `❌ <b>Error:</b> ${error.message}`);
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
    await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
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
    await (0, utils_1.safeDelete)(ctx);
    if (!text || isNaN(parseFloat(text.replace(/,/g, '')))) {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery('⚠️ Please enter a number').catch(() => { });
        return;
    }
    const amount = parseFloat(text.replace(/,/g, ''));
    ctx.wizard.state.data.amount = amount;
    try {
        const quote = await switch_1.switchService.getOnrampQuote(amount, ctx.wizard.state.data.country, ctx.wizard.state.data.asset.id, ctx.wizard.state.data.currency);
        ctx.wizard.state.quote = quote;
        const msg = `
📊 <b>Review Quote</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 <b>You Pay:</b> ${(0, utils_1.formatAmount)(quote.source.amount)} ${ctx.wizard.state.data.currency}
💰 <b>You Get:</b> ${(0, utils_1.formatAmount)(quote.destination.amount)} ${ctx.wizard.state.data.symbol}

📈 <b>Rate:</b> 1 ${ctx.wizard.state.data.symbol} = ${(0, utils_1.formatAmount)(quote.rate)} ${ctx.wizard.state.data.currency}
${quote.fee ? `💳 <b>Fee:</b> ${(0, utils_1.formatAmount)(quote.fee.total)} ${quote.fee.currency}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ <i>Expires in 5 minutes</i>
`;
        await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('✅ Confirm & Continue', 'proceed')],
            [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    }
    catch (error) {
        let errorMsg = error.message;
        if (errorMsg.includes('Maximum amount')) {
            errorMsg = `⚠️ <b>Limit Exceeded</b>\n\nThe maximum amount allowed per transaction is <b>10,000 ${ctx.wizard.state.data.symbol}</b>. Please enter a smaller amount.`;
        }
        else {
            errorMsg = `❌ <b>Error:</b> ${errorMsg}`;
        }
        await (0, utils_1.safeEdit)(ctx, errorMsg, telegraf_1.Markup.inlineKeyboard([
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
    await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
    ]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a, _b;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (data === 'back') {
            ctx.wizard.selectStep(4);
            return ctx.wizard.steps[4](ctx);
        }
        if (data === 'cancel')
            return ctx.scene.leave();
        return;
    }
    const walletAddress = (_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim();
    if (walletAddress)
        await (0, utils_1.safeDelete)(ctx);
    if (!walletAddress || walletAddress.length < 20) {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery('⚠️ Invalid wallet address').catch(() => { });
        return;
    }
    ctx.wizard.state.data.walletAddress = walletAddress;
    try {
        await (0, utils_1.safeEdit)(ctx, '⏳ <i>Creating order...</i>');
        const result = await switch_1.switchService.initiateOnramp({
            amount: ctx.wizard.state.data.amount,
            country: ctx.wizard.state.data.country,
            asset: ctx.wizard.state.data.asset.id,
            walletAddress: walletAddress,
            currency: ctx.wizard.state.data.currency
        });
        const msg = `
✅ <b>Order Created!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Reference:</b> <code>${result.reference}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏦 <b>Make Payment:</b>

Bank: <b>${result.deposit.bank_name}</b>
Account: <code>${result.deposit.account_number}</code>
Name: <b>${result.deposit.account_name}</b>
Amount: <b>${(0, utils_1.formatAmount)(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.currency}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Your crypto will be sent automatically after your transfer is confirmed.</i>
`;
        await (0, utils_1.safeEdit)(ctx, msg, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('💳 I have paid', `confirm_${result.reference}`)],
            [telegraf_1.Markup.button.callback('🏠 Main Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
    catch (error) {
        await (0, utils_1.safeEdit)(ctx, `❌ <b>Order Failed:</b> ${error.message}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
});
exports.onrampWizard = onrampWizard;
//# sourceMappingURL=onramp.js.map