import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { storageService } from '../../services/storage';
import { Beneficiary } from '../../types';
import { formatAmount, safeEdit, safeDelete, paginationKeyboard, formatButtons21, sortBanksByPriority } from '../../utils';
import { MAIN_KEYBOARD } from '../keyboards';

const offrampWizard = new Scenes.WizardScene(
    'offramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Symbol Selection (index 0)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = { beneficiary: {} };
        try {
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
            const assets = await switchService.getAssets();
            ctx.wizard.state.assets = assets;

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
🪙 <b>Select Asset</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose the crypto asset you wish to sell:
`;
            const buttons = symbols.map(s => Markup.button.callback(s, `symbol:${s}`));
            const rows = formatButtons21(buttons);
            rows.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(rows));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithHTML(`❌ <b>Error:</b> ${error.message}`, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Back to Menu', 'cancel')]
            ]));
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 2: Network Selection (index 1)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
        if (data === 'cancel') return ctx.scene.leave();

        if (data.startsWith('symbol:')) {
            const symbol = data.replace('symbol:', '');
            ctx.wizard.state.data.symbol = symbol;
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
    // Step 3: Country Selection (index 2)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

        if (data === 'back_to_symbol') {
            ctx.wizard.selectStep(0);
            return ctx.wizard.steps[0](ctx);
        }
        if (data === 'cancel') return ctx.scene.leave();

        if (data.startsWith('asset:')) {
            const assetId = data.replace('asset:', '');
            const asset = ctx.wizard.state.assets.find((a: any) => a.id === assetId);
            ctx.wizard.state.data.asset = asset;
        } else {
            return;
        }

        try {
            const coverage = await switchService.getCoverage('OFFRAMP');
            ctx.wizard.state.coverage = coverage;

            const msg = `
🌍 <b>Select Currency</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selling: <b>${ctx.wizard.state.data.symbol}</b> (${ctx.wizard.state.data.asset.blockchain.name})

Choose your local currency:
`;
            const allowedCountries = ['NG', 'GH', 'KE'];
            const flagMap: Record<string, string> = {
                'NG': '🇳🇬',
                'GH': '🇬🇭',
                'KE': '🇰🇪'
            };

            const filteredCoverage = coverage.filter((c: any) => allowedCountries.includes(c.country));

            const currencyButtons = filteredCoverage.map((c: any) => {
                const currency = Array.isArray(c.currency) ? c.currency[0] : c.currency;
                const flag = flagMap[c.country] || '🌍';
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
    // Step 4: Amount Input (index 3)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

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

How many <b>${ctx.wizard.state.data.symbol}</b> would you like to sell?

<i>Example: 100</i>
`;
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 5: Show Quote (index 4)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'back') {
                ctx.wizard.selectStep(2); // Back to Country selection
                return ctx.wizard.steps[2](ctx);
            }
            if (data === 'cancel') return ctx.scene.leave();
            return;
        }

        const text = ctx.message?.text;
        // await safeDelete(ctx); // Stop deleting

        if (!text || isNaN(parseFloat(text.replace(/,/g, '')))) {
            if (ctx.callbackQuery) await ctx.answerCbQuery('⚠️ Please enter a number').catch(() => { });
            else await ctx.reply('⚠️ Please enter a valid number');
            return;
        }

        const amount = parseFloat(text.replace(/,/g, ''));
        ctx.wizard.state.data.amount = amount;

        try {
            const quote = await switchService.getOfframpQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset.id,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 <b>Review Quote</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 <b>You Sell:</b> ${formatAmount(quote.source.amount)} ${ctx.wizard.state.data.symbol}
💵 <b>You Get:</b> ${formatAmount(quote.destination.amount)} ${quote.destination.currency}

📈 <b>Rate:</b> 1 ${ctx.wizard.state.data.symbol} = ${formatAmount(quote.rate)} ${quote.destination.currency}
${quote.fee ? `💳 <b>Fee:</b> ${formatAmount(quote.fee.total)} ${quote.fee.currency}` : ''}
⚡️ <b>Platform Fee:</b> 0.9%

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
    // Step 6: Account Number Entry (index 5)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'back') {
            ctx.wizard.selectStep(3); // Back to amount entry
            return ctx.wizard.steps[3](ctx);
        }
        if (data === 'cancel') return ctx.scene.leave();
        if (data !== 'proceed') return; // Ensure we only proceed on 'proceed'

        if (ctx.callbackQuery) await ctx.answerCbQuery('Quote confirmed!');

        const saved = ctx.from ? storageService.getBeneficiaries(ctx.from.id).filter(b => b.bankCode && b.accountNumber) : [];
        ctx.wizard.state.savedBeneficiaries = saved;

        const msg = `
💳 <b>Withdrawal Account</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type your <b>Bank Account Number</b> below:

<i>Example: 0123456789</i>
`;
        const allButtons = [
            ...(ctx.from ? storageService.getBeneficiaries(ctx.from.id).filter(b => b.bankCode && b.accountNumber).slice(0, 3).map(b =>
                Markup.button.callback(`👤 ${b.holderName} (${b.bankName})`, `use_saved:${b.id}`)
            ) : []),
            Markup.button.callback('⬅️ Back', 'back'),
            Markup.button.callback('❌ Cancel', 'cancel')
        ];

        const buttons = formatButtons21(allButtons);
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 7: Bank Selection (index 6)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

            if (data === 'cancel') return ctx.scene.leave();
            if (data === 'back') {
                ctx.wizard.selectStep(4); // Back to Quote review button screen
                return ctx.wizard.steps[4](ctx);
            }

            if (data.startsWith('use_saved:')) {
                const id = parseInt(data.replace('use_saved:', ''));
                const selected = ctx.wizard.state.savedBeneficiaries.find((b: any) => b.id === id);
                if (selected) {
                    ctx.wizard.state.data.beneficiary = { ...selected };
                    ctx.wizard.selectStep(7); // Jump to Verification & Review
                    return ctx.wizard.steps[7](ctx);
                }
            }

            // Handle Bank Selection Callback (Lands in this step)
            if (data.startsWith('bank:')) {
                const bankCode = data.replace('bank:', '');
                const bank = ctx.wizard.state.banks.find((b: any) => b.code === bankCode);
                ctx.wizard.state.data.beneficiary.bankCode = bankCode;
                ctx.wizard.state.data.beneficiary.bankName = bank.name;

                // Advance to Review
                ctx.wizard.next();
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            }

            // Handle Pagination Callback (Lands in this step)
            if (data.startsWith('page:')) {
                const page = parseInt(data.replace('page:', ''));
                ctx.wizard.state.bankPage = page;
                const kb = paginationKeyboard(ctx.wizard.state.banks, page, 10, 'bank', 'cancel', 'back_to_acc');
                await ctx.replyWithHTML(ctx.wizard.state.bankMsg, kb);
                return;
            }

            if (data === 'back_to_acc') {
                ctx.wizard.selectStep(5); // Re-show Account Number Entry
                return ctx.wizard.steps[5](ctx);
            }
        }

        const accountNumber = ctx.message?.text?.trim();
        if (accountNumber) {
            // await safeDelete(ctx); // Stop deleting
            ctx.wizard.state.data.beneficiary.accountNumber = accountNumber;
        }

        try {
            if (!ctx.wizard.state.banks) {
                const banks = await switchService.getInstitutions(ctx.wizard.state.data.country);
                ctx.wizard.state.banks = sortBanksByPriority(banks);
            }

            const page = ctx.wizard.state.bankPage || 0;
            const msg = `
🏦 <b>Select Bank</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: <code>${ctx.wizard.state.data.beneficiary.accountNumber}</code>

Choose your receiving bank:
`;
            ctx.wizard.state.bankMsg = msg;
            const kb = paginationKeyboard(ctx.wizard.state.banks, page, 10, 'bank', 'cancel', 'back_to_acc');
            await ctx.replyWithHTML(msg, kb);
            // Stay in this step to handle callbacks
            return;
        } catch (e) {
            await ctx.replyWithHTML('❌ Failed to load banks. Type /cancel to restart.');
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 8: Verification & Review (index 7)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });

            if (data === 'cancel') return ctx.scene.leave();

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
                const result = await switchService.lookupInstitution(ctx.wizard.state.data.country, b.bankCode, b.accountNumber);

                const possibleFields = ['account_name', 'accountName', 'name', 'holder_name', 'beneficiary_name'];
                let name = '';
                for (const field of possibleFields) {
                    if (result[field]) { name = result[field]; break; }
                }
                if (!name && result.beneficiary) {
                    for (const field of possibleFields) {
                        if (result.beneficiary[field]) { name = result.beneficiary[field]; break; }
                    }
                }

                if (name) {
                    ctx.wizard.state.data.beneficiary.holderName = name;
                } else {
                    throw new Error('Name not found');
                }
            } catch (error: any) {
                const failButtons = formatButtons21([
                    Markup.button.callback('🏦 Change Bank', 'change_bank'),
                    Markup.button.callback('💳 Change Account', 'change_account'),
                    Markup.button.callback('❌ Cancel', 'cancel')
                ]);
                await ctx.replyWithHTML(`❌ <b>Verification Failed</b>`, Markup.inlineKeyboard(failButtons));
                return;
            }
        }

        if (b.holderName) {
            const msg = `
🏁 <b>Review Transfer</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 <b>Holder:</b> ${b.holderName}
🏦 <b>Bank:</b> ${b.bankName}
💳 <b>Account:</b> <code>${b.accountNumber}</code>

💸 <b>Selling:</b> ${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.symbol}
💵 <b>Receiving:</b> ${formatAmount(ctx.wizard.state.quote.destination.amount)} ${ctx.wizard.state.data.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Proceed with this transaction?*
`;
            const allReviewButtons = [
                Markup.button.callback('🚀 Yes, Create Order', 'initiate'),
                Markup.button.callback('❌ Cancel', 'cancel')
            ];

            // Only show save button if not already saved
            const saved = storageService.getBeneficiaries(ctx.from.id);
            const isSaved = saved.some(s => s.accountNumber === b.accountNumber && s.bankCode === b.bankCode);
            if (!isSaved) {
                allReviewButtons.unshift(Markup.button.callback('💾 Save this Account', 'save_account'));
            }

            const buttons = formatButtons21(allReviewButtons);
            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 9: Order Creation (index 8)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;

        if (data === 'save_account') {
            try {
                const b = ctx.wizard.state.data.beneficiary;
                storageService.addBeneficiary({
                    userId: ctx.from.id,
                    holderName: b.holderName,
                    bankCode: b.bankCode,
                    accountNumber: b.accountNumber,
                    bankName: b.bankName
                });
                await ctx.answerCbQuery('✅ Account saved to your list!');

                // Update the message to remove the save button
                const msg = ctx.callbackQuery.message.text || '🏁 <b>Review Transfer</b>...';
                await safeEdit(ctx, msg, Markup.inlineKeyboard([
                    [Markup.button.callback('🚀 Yes, Create Order', 'initiate')],
                    [Markup.button.callback('❌ Cancel', 'cancel')]
                ]));
                return;
            } catch (e: any) {
                await ctx.answerCbQuery('❌ Error saving account: ' + e.message);
                return;
            }
        }

        if (data === 'cancel') return ctx.scene.leave();
        if (data !== 'initiate') return;

        try {
            await ctx.replyWithHTML('⏳ <i>Creating secure wallet...</i>');

            const result = await switchService.initiateOfframp({
                amount: ctx.wizard.state.data.amount,
                country: ctx.wizard.state.data.country,
                asset: ctx.wizard.state.data.asset.id,
                currency: ctx.wizard.state.data.currency,
                beneficiary: {
                    bankCode: ctx.wizard.state.data.beneficiary.bankCode,
                    accountNumber: ctx.wizard.state.data.beneficiary.accountNumber,
                    holderName: ctx.wizard.state.data.beneficiary.holderName
                }
            });

            // Save transaction to local database
            storageService.addTransaction(
                ctx.from.id,
                result.reference,
                'OFFRAMP',
                ctx.wizard.state.data.asset.id, // Store asset ID (e.g., 'ethereum:usdc') for network parsing
                ctx.wizard.state.data.amount
            );

            const msg = `
✅ <b>Order Created!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Reference:</b> <code>${result.reference}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 <b>Send EXACTLY:</b>
<b>${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.symbol}</b>

📍 <b>Recipient Address:</b>
<code>${result.deposit.address}</code>

Network: <b>${ctx.wizard.state.data.asset.blockchain.name}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Your payment will be processed automatically after confirmation.</i>
`;
            const buttons = [
                [Markup.button.callback('📊 Track Status', `status_${result.reference}`)],
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

export { offrampWizard };
