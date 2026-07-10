"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalWizard = void 0;
const telegraf_1 = require("telegraf");
const storage_1 = require("../../services/storage");
exports.withdrawalWizard = new telegraf_1.Scenes.WizardScene('withdrawal-wizard', async (ctx) => {
    try {
        if (ctx.callbackQuery)
            await ctx.answerCbQuery().catch(() => { });
        const stats = storage_1.storageService.getUserReferralStats(ctx.from.id);
        if (stats.balance < 5) {
            await ctx.replyWithHTML(`⚠️ You need a minimum balance of <b>$5</b> to withdraw.\n\nYour current balance is <b>$${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</b>`, telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]
            ]));
            return ctx.scene.leave();
        }
        ctx.wizard.state.balance = stats.balance;
        await ctx.replyWithHTML(`
💸 <b>Withdraw Referral Earnings</b>

Your Balance: <b>$${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</b>

Enter the amount you wish to withdraw (Min: $5):
            `, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]]));
        return ctx.wizard.next();
    }
    catch (e) {
        return ctx.scene.leave();
    }
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
        await ctx.answerCbQuery().catch(() => { });
        return ctx.scene.leave();
    }
    const text = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text;
    const amount = parseFloat((text === null || text === void 0 ? void 0 : text.replace(/,/g, '')) || '0');
    if (isNaN(amount) || amount < 5) {
        return ctx.reply('⚠️ Please enter a valid amount of at least 5.');
    }
    if (amount > ctx.wizard.state.balance) {
        return ctx.reply(`⚠️ You only have $${ctx.wizard.state.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}. Please enter a smaller amount.`);
    }
    ctx.wizard.state.amount = amount;
    await ctx.replyWithHTML(`
Great! You are withdrawing <b>$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>.

Please enter your destination <b>Chain / Network</b> (e.g., Solana, BSC, TRC20):
        `, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a;
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
        await ctx.answerCbQuery().catch(() => { });
        return ctx.scene.leave();
    }
    ctx.wizard.state.chain = ((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) || 'Unknown';
    await ctx.replyWithHTML(`
Almost done!

Please enter your <b>Wallet Address</b>:
        `, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('❌ Cancel', 'cancel')]]));
    return ctx.wizard.next();
}, async (ctx) => {
    var _a, _b;
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
        await ctx.answerCbQuery().catch(() => { });
        return ctx.scene.leave();
    }
    ctx.wizard.state.wallet = ((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    if (ctx.wizard.state.wallet.length < 10) {
        return ctx.reply('⚠️ Invalid wallet address. Please try again.');
    }
    try {
        await ctx.reply('⏳ Submitting your withdrawal request...');
        const result = storage_1.storageService.requestWithdrawal(ctx.from.id, ctx.wizard.state.amount, ctx.wizard.state.wallet, ctx.wizard.state.chain);
        await ctx.replyWithHTML(`
✅ <b>Withdrawal Requested!</b>

Your request for <b>$${ctx.wizard.state.amount.toLocaleString()}</b> has been submitted and is pending admin approval.
You will be notified once it is processed!
            `, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🏠 Back to Menu', 'action_menu')]]));
    }
    catch (e) {
        await ctx.reply(`❌ Failed to request withdrawal: ${e.message}`);
    }
    return ctx.scene.leave();
});
//# sourceMappingURL=withdraw.js.map