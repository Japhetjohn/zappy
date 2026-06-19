import { Scenes, Markup } from 'telegraf';
import { storageService } from '../../services/storage';

export const withdrawalWizard = new Scenes.WizardScene(
    'withdrawal-wizard',
    async (ctx: any) => {
        try {
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
            const stats = storageService.getUserReferralStats(ctx.from.id);
            if (stats.balance < 5) {
                await ctx.replyWithHTML(`⚠️ You need a minimum balance of <b>$5</b> to withdraw.\n\nYour current balance is <b>$${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</b>`, Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Back to Menu', 'action_menu')]
                ]));
                return ctx.scene.leave();
            }
            ctx.wizard.state.balance = stats.balance;
            await ctx.replyWithHTML(`
💸 <b>Withdraw Referral Earnings</b>

Your Balance: <b>$${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</b>

Enter the amount you wish to withdraw (Min: $5):
            `, Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]]));
            return ctx.wizard.next();
        } catch(e) {
            return ctx.scene.leave();
        }
    },
    async (ctx: any) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
             await ctx.answerCbQuery().catch(() => {});
             return ctx.scene.leave();
        }
        
        const text = ctx.message?.text;
        const amount = parseFloat(text?.replace(/,/g, '') || '0');
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
        `, Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]]));
        return ctx.wizard.next();
    },
    async (ctx: any) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
             await ctx.answerCbQuery().catch(() => {});
             return ctx.scene.leave();
        }
        ctx.wizard.state.chain = ctx.message?.text || 'Unknown';
        await ctx.replyWithHTML(`
Almost done!

Please enter your <b>Wallet Address</b>:
        `, Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]]));
        return ctx.wizard.next();
    },
    async (ctx: any) => {
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'cancel') {
             await ctx.answerCbQuery().catch(() => {});
             return ctx.scene.leave();
        }
        ctx.wizard.state.wallet = ctx.message?.text?.trim() || '';
        if (ctx.wizard.state.wallet.length < 10) {
           return ctx.reply('⚠️ Invalid wallet address. Please try again.');
        }
        
        try {
            await ctx.reply('⏳ Submitting your withdrawal request...');
            const result = storageService.requestWithdrawal(ctx.from.id, ctx.wizard.state.amount, ctx.wizard.state.wallet, ctx.wizard.state.chain);
            await ctx.replyWithHTML(`
✅ <b>Withdrawal Requested!</b>

Your request for <b>$${ctx.wizard.state.amount.toLocaleString()}</b> has been submitted and is pending admin approval.
You will be notified once it is processed!
            `, Markup.inlineKeyboard([[Markup.button.callback('🏠 Back to Menu', 'action_menu')]]));
        } catch (e: any) {
            await ctx.reply(`❌ Failed to request withdrawal: ${e.message}`);
        }
        return ctx.scene.leave();
    }
);
