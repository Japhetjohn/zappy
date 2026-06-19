"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offrampWizard = void 0;
const telegraf_1 = require("telegraf");
const switch_1 = require("../../services/switch");
const storage_1 = require("../../services/storage");
const config_1 = require("../../config");
const utils_1 = require("../../utils");
const keyboards_1 = require("../keyboards");
const offrampWizard = new telegraf_1.Scenes.WizardScene('offramp-wizard', async (ctx) => {
    ctx.wizard.state.data = { beneficiary: {} };
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
🪙 <b>Sell Crypto</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose the crypto asset you wish to sell:



━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        const buttons = symbols.map(s => telegraf_1.Markup.button.callback(s, `symbol:${s}`));
        const rows = (0, utils_1.formatButtons21)(buttons);
        rows.push([telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]);
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(rows));
        return ctx.wizard.next();
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data.startsWith('symbol:')) {
        const symbol = data.replace('symbol:', '');
        ctx.wizard.state.data.symbol = symbol;
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
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
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
    }
    else {
        return;
    }
    try {
        const coverage = await switch_1.switchService.getCoverage('OFFRAMP');
        ctx.wizard.state.coverage = coverage;
        const msg = `
🌍 <b>Select Currency</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selling: <b>${ctx.wizard.state.data.symbol}</b> (${ctx.wizard.state.data.asset.blockchain.name})

Choose your local currency:
`;
        const allowedCountries = ['NG', 'GH', 'KE'];
        const flagMap = {
            'NG': '🇳🇬',
            'GH': '🇬🇭',
            'KE': '🇰🇪'
        };
        const filteredCoverage = coverage.filter((c) => allowedCountries.includes(c.country));
        const currencyButtons = filteredCoverage.map((c) => {
            const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
            const flag = flagMap[c.country] || '🌍';
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
    if (ctx.callbackQuery)
        await ctx.answerCbQuery().catch(() => { });
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

How many <b>${ctx.wizard.state.data.symbol}</b> would you like to sell?

<i>Example: 100</i>
`;
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⬅️ Back', 'back'), telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]
    ]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
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
        else
            await ctx.reply('⚠️ Please enter a valid number');
        return;
    }
    const amount = parseFloat(text.replace(/,/g, ''));
    ctx.wizard.state.data.amount = amount;
    try {
        const pointSettings = storage_1.storageService.getPointSettings();
        const userPoints = storage_1.storageService.getUserPoints(ctx.from.id);
        const redeemablePoints = Math.min(userPoints, pointSettings.maxPerTx);
        const pointsDiscountPct = redeemablePoints * pointSettings.valuePct;
        const settings = storage_1.storageService.getSettings();
        const platformFeeRaw = settings.platform_fee || config_1.config.developerFee.toString();
        const platformFee = parseFloat(platformFeeRaw);
        const baseQuote = await switch_1.switchService.getOfframpQuote(amount, ctx.wizard.state.data.country, ctx.wizard.state.data.asset.id, ctx.wizard.state.data.currency, platformFee);
        const bonusQuote = await switch_1.switchService.getOfframpQuote(amount, ctx.wizard.state.data.country, ctx.wizard.state.data.asset.id, ctx.wizard.state.data.currency, undefined, pointsDiscountPct);
        ctx.wizard.state.quote = bonusQuote;
        ctx.wizard.state.baseQuote = baseQuote;
        ctx.wizard.state.platformFee = platformFee;
        ctx.wizard.state.pointsRedeemed = redeemablePoints;
        ctx.wizard.state.pointsDiscountPct = pointsDiscountPct;
        const hasBonus = redeemablePoints > 0 && bonusQuote.destination.amount > baseQuote.destination.amount;
        let msg = `
📊 <b>Review Quote</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 <b>You Sell:</b> ${(0, utils_1.formatAmount)(bonusQuote.source.amount)} ${ctx.wizard.state.data.symbol}
💵 <b>You Get:</b> ${(0, utils_1.formatAmount)(bonusQuote.destination.amount)} ${bonusQuote.destination.currency}
`;
        if (hasBonus) {
            msg += `
🎁 <b>You have earned ${pointsDiscountPct}% bonus on your transaction</b>
⭐ <b>Points Used:</b> ${redeemablePoints}
💡 <i>Do more transactions to unlock higher bonuses</i>
`;
        }
        else if (userPoints > 0) {
            msg += `
⭐ <b>Your Points:</b> ${userPoints.toLocaleString()}
💡 <i>Do more transactions to unlock higher bonuses</i>
`;
        }
        msg += `
📈 <b>Rate:</b> 1 ${ctx.wizard.state.data.symbol} = ${(0, utils_1.formatAmount)(bonusQuote.rate)} ${bonusQuote.destination.currency}
${bonusQuote.fee ? `💳 <b>Fee:</b> ${(0, utils_1.formatAmount)(bonusQuote.fee.total)} ${bonusQuote.fee.currency}` : ''}


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
            userMessage = `⚠️ The minimum sale is <b>1 ${ctx.wizard.state.data.symbol}</b>.\n\nPlease enter a larger amount.`;
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
    if (data === 'back') {
        ctx.wizard.selectStep(3);
        return ctx.wizard.steps[3](ctx);
    }
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data !== 'proceed')
        return;
    if (ctx.callbackQuery)
        await ctx.answerCbQuery('Quote confirmed!');
    const saved = ctx.from ? storage_1.storageService.getBeneficiaries(ctx.from.id).filter(b => b.bankCode && b.accountNumber) : [];
    ctx.wizard.state.savedBeneficiaries = saved;
    const msg = `
💳 <b>Withdrawal Account</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type your <b>Bank Account Number</b> below:

<i>Example: 0123456789</i>

${saved.length > 0 ? '\n<b>Or choose from saved account below 👇</b>' : ''}
`;
    const allButtons = [
        ...(ctx.from ? storage_1.storageService.getBeneficiaries(ctx.from.id).filter(b => b.bankCode && b.accountNumber).slice(0, 3).map(b => telegraf_1.Markup.button.callback(`👤 ${b.holderName} (${b.bankName})`, `use_saved:${b.id}`)) : []),
        telegraf_1.Markup.button.callback('⬅️ Back', 'back'),
        telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')
    ];
    const buttons = (0, utils_1.formatButtons21)(allButtons);
    await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a, _b;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (data === 'cancel')
            return ctx.scene.leave();
        if (data === 'back') {
            ctx.wizard.selectStep(4);
            return ctx.wizard.steps[4](ctx);
        }
        if (data.startsWith('use_saved:')) {
            const id = parseInt(data.replace('use_saved:', ''));
            const selected = ctx.wizard.state.savedBeneficiaries.find((b) => b.id === id);
            if (selected) {
                ctx.wizard.state.data.beneficiary = { ...selected };
                ctx.wizard.selectStep(7);
                return ctx.wizard.steps[7](ctx);
            }
        }
        if (data.startsWith('bank:')) {
            const bankCode = data.replace('bank:', '');
            const bank = ctx.wizard.state.banks.find((b) => b.code === bankCode);
            ctx.wizard.state.data.beneficiary.bankCode = bankCode;
            ctx.wizard.state.data.beneficiary.bankName = bank.name;
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
        if (data.startsWith('page:')) {
            const page = parseInt(data.replace('page:', ''));
            ctx.wizard.state.bankPage = page;
            const kb = (0, utils_1.paginationKeyboard)(ctx.wizard.state.banks, page, 10, 'bank', 'cancel', 'back_to_acc');
            await ctx.replyWithHTML(ctx.wizard.state.bankMsg, kb);
            return;
        }
        if (data === 'back_to_acc') {
            ctx.wizard.selectStep(5);
            return ctx.wizard.steps[5](ctx);
        }
    }
    const accountNumber = (_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim();
    if (accountNumber) {
        ctx.wizard.state.data.beneficiary.accountNumber = accountNumber;
    }
    try {
        if (!ctx.wizard.state.banks) {
            const banks = await switch_1.switchService.getInstitutions(ctx.wizard.state.data.country);
            ctx.wizard.state.banks = (0, utils_1.sortBanksByPriority)(banks);
        }
        const page = ctx.wizard.state.bankPage || 0;
        const msg = `
🏦 <b>Select Bank</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: <code>${ctx.wizard.state.data.beneficiary.accountNumber}</code>

Choose your receiving bank:
`;
        ctx.wizard.state.bankMsg = msg;
        const kb = (0, utils_1.paginationKeyboard)(ctx.wizard.state.banks, page, 10, 'bank', 'cancel', 'back_to_acc');
        await ctx.replyWithHTML(msg, kb);
        return;
    }
    catch (e) {
        await ctx.replyWithHTML('❌ Failed to load banks. Type /cancel to restart.');
    }
}, async (ctx) => {
    var _a, _b;
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        if (data === 'cancel')
            return ctx.scene.leave();
        if (data === 'change_bank') {
            ctx.wizard.selectStep(6);
            return ctx.wizard.steps[6](ctx);
        }
        if (data === 'change_account') {
            ctx.wizard.selectStep(5);
            return ctx.wizard.steps[5](ctx);
        }
        if (data === 'initiate') {
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
    }
    const b = ctx.wizard.state.data.beneficiary;
    if (!b.holderName && b.bankCode && b.accountNumber) {
        try {
            await ctx.replyWithHTML('⏳ <i>Verifying account...</i>');
            const result = await switch_1.switchService.lookupInstitution(ctx.wizard.state.data.country, b.bankCode, b.accountNumber);
            const possibleFields = ['account_name', 'accountName', 'name', 'holder_name', 'beneficiary_name'];
            let name = '';
            for (const field of possibleFields) {
                if (result[field]) {
                    name = result[field];
                    break;
                }
            }
            if (!name && result.beneficiary) {
                for (const field of possibleFields) {
                    if (result.beneficiary[field]) {
                        name = result.beneficiary[field];
                        break;
                    }
                }
            }
            if (name) {
                ctx.wizard.state.data.beneficiary.holderName = name;
            }
            else {
                throw new Error('Name not found');
            }
        }
        catch (error) {
            const failButtons = (0, utils_1.formatButtons21)([
                telegraf_1.Markup.button.callback('🏦 Change Bank', 'change_bank'),
                telegraf_1.Markup.button.callback('💳 Change Account', 'change_account'),
                telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')
            ]);
            await ctx.replyWithHTML(`❌ <b>Verification Failed</b>`, telegraf_1.Markup.inlineKeyboard(failButtons));
            return;
        }
    }
    if (b.holderName) {
        const hasBonus = (ctx.wizard.state.pointsRedeemed || 0) > 0;
        const baseAmount = ((_b = (_a = ctx.wizard.state.baseQuote) === null || _a === void 0 ? void 0 : _a.destination) === null || _b === void 0 ? void 0 : _b.amount) || ctx.wizard.state.quote.destination.amount;
        const bonusAmount = ctx.wizard.state.quote.destination.amount;
        let msg = `
🏁 <b>Review Transfer</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 <b>Holder:</b> ${b.holderName}
🏦 <b>Bank:</b> ${b.bankName}
💳 <b>Account:</b> <code>${b.accountNumber}</code>

💸 <b>Selling:</b> ${(0, utils_1.formatAmount)(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.symbol}
💵 <b>Receiving:</b> ${(0, utils_1.formatAmount)(bonusAmount)} ${ctx.wizard.state.data.currency}
`;
        if (hasBonus) {
            msg += `
🎁 <b>You have earned ${ctx.wizard.state.pointsDiscountPct}% bonus on your transaction</b>
⭐ <b>Points Used:</b> ${ctx.wizard.state.pointsRedeemed}
💡 <i>Do more transactions to unlock higher bonuses</i>
`;
        }
        msg += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Proceed with this transaction?*
`;
        const allReviewButtons = [
            telegraf_1.Markup.button.callback('🚀 Yes, Create Order', 'initiate'),
            telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')
        ];
        const buttons = (0, utils_1.formatButtons21)(allReviewButtons);
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
    }
}, async (ctx) => {
    var _a;
    if (!ctx.callbackQuery)
        return;
    const data = ctx.callbackQuery.data;
    if (data === 'cancel')
        return ctx.scene.leave();
    if (data !== 'initiate')
        return;
    try {
        await ctx.replyWithHTML('⏳ <i>Creating secure wallet...</i>');
        const result = await switch_1.switchService.initiateOfframp({
            amount: ctx.wizard.state.data.amount,
            country: ctx.wizard.state.data.country,
            asset: ctx.wizard.state.data.asset.id,
            currency: ctx.wizard.state.data.currency,
            beneficiary: {
                bankCode: ctx.wizard.state.data.beneficiary.bankCode,
                accountNumber: ctx.wizard.state.data.beneficiary.accountNumber,
                holderName: ctx.wizard.state.data.beneficiary.holderName
            },
            developerFee: ctx.wizard.state.platformFee,
            pointDiscountPct: ctx.wizard.state.pointsDiscountPct
        });
        try {
            storage_1.storageService.addBeneficiary({
                userId: ctx.from.id,
                holderName: ctx.wizard.state.data.beneficiary.holderName,
                bankCode: ctx.wizard.state.data.beneficiary.bankCode,
                accountNumber: ctx.wizard.state.data.beneficiary.accountNumber,
                bankName: ctx.wizard.state.data.beneficiary.bankName
            });
        }
        catch (e) {
        }
        storage_1.storageService.addTransactionAndRedeemPoints({
            userId: ctx.from.id,
            reference: result.reference,
            type: 'OFFRAMP',
            asset: ctx.wizard.state.data.asset.id,
            amount: ctx.wizard.state.data.amount,
            currency: 'USD',
            pointsRedeemed: ctx.wizard.state.pointsRedeemed || 0,
            pointsDiscountPct: ctx.wizard.state.pointsDiscountPct || 0
        });
        const msg = `
✅ <b>Order Created!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Reference:</b> <code>${result.reference}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 <b>Send EXACTLY:</b>
<b>${(0, utils_1.formatAmount)(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.symbol}</b>

📍 <b>Recipient Address:</b>
<code>${result.deposit.address}</code>

Network: <b>${ctx.wizard.state.data.asset.blockchain.name}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Your payment will be processed automatically after confirmation.</i>
`;
        const buttons = [
            ...(((_a = keyboards_1.MAIN_KEYBOARD.reply_markup) === null || _a === void 0 ? void 0 : _a.inline_keyboard) || [])
        ];
        await ctx.replyWithHTML(msg, telegraf_1.Markup.inlineKeyboard(buttons));
        return ctx.scene.leave();
    }
    catch (error) {
        await ctx.replyWithHTML(`❌ <b>Order Failed:</b> ${error.message}`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'cancel')]
        ]));
        return ctx.scene.leave();
    }
});
exports.offrampWizard = offrampWizard;
//# sourceMappingURL=offramp.js.map