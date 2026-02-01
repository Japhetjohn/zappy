import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { storageService } from '../../services/storage';
import { Beneficiary } from '../../types';

// Helper to format numbers nicely
const formatAmount = (num: number): string => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
};

// Bank code to name mapping
const BANK_MAP: Record<string, string> = {
    '058': 'GTBank',
    '011': 'First Bank',
    '044': 'Access Bank',
    '033': 'UBA',
    '057': 'Zenith Bank',
    '063': 'Diamond Bank',
    '070': 'Fidelity Bank',
    '076': 'Polaris Bank'
};

const offrampWizard = new Scenes.WizardScene(
    'offramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Welcome & Asset Selection
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = {};

        const msg = `
💸 *Sell Crypto*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the crypto you want to sell:
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
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
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

Selling: *${ctx.wizard.state.data.assetName}*

Choose your country:
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('🇳🇬 Nigeria', 'NG')],
            [Markup.button.callback('🇬🇭 Ghana (Coming Soon)', 'soon')],
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
                await ctx.answerCbQuery('Coming soon!');
                return;
            }
            ctx.wizard.state.data.country = data;
            ctx.wizard.state.data.currency = 'NGN';
            await ctx.answerCbQuery('Nigeria selected');
        }

        const msg = `
💰 *Enter Amount*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selling: *${ctx.wizard.state.data.assetName}*
Receiving: *NGN (₦)*

Enter the amount of ${ctx.wizard.state.data.assetName} you want to sell:

_Example: 100_
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
            await ctx.replyWithMarkdown('⚠️ Please enter a valid number.\n\n_Example: 100_');
            return;
        }

        const amount = parseFloat(text.replace(/,/g, ''));
        if (amount < 1) {
            await ctx.replyWithMarkdown('⚠️ Minimum amount is 1 ' + ctx.wizard.state.data.assetName);
            return;
        }

        ctx.wizard.state.data.amount = amount;

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching best rates..._');

            const quote = await switchService.getOfframpQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 *Quote Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *You Sell:* ${formatAmount(quote.source.amount)} ${ctx.wizard.state.data.assetName}

💵 *You Get:* ₦${formatAmount(quote.destination.amount)}

📈 *Rate:* 1 ${ctx.wizard.state.data.assetName} = ₦${formatAmount(quote.rate)}

💳 *Fee:* ${formatAmount(quote.fee.total)} ${quote.fee.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱ _Quote expires in 5 minutes_

Proceed with this transaction?
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm & Continue', 'proceed')],
                [Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return ctx.wizard.next();

        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 5: Beneficiary Selection or New Entry
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }
            await ctx.answerCbQuery('Quote confirmed!');
        }

        // Get saved beneficiaries
        const beneficiaries = ctx.from ? storageService.getBeneficiaries(ctx.from.id) : [];
        ctx.wizard.state.beneficiaries = beneficiaries;

        if (beneficiaries.length > 0) {
            // Show saved beneficiaries
            let msg = `
🏦 *Select Bank Account*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Your Saved Accounts:*

`;
            beneficiaries.forEach((b: Beneficiary, i: number) => {
                msg += `${i + 1}. *${b.holderName}*\n   ${b.bankName} • \`${b.accountNumber}\`\n\n`;
            });

            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━

_Select an account or add a new one:_`;

            const buttons = beneficiaries.slice(0, 5).map((b: Beneficiary, i: number) =>
                [Markup.button.callback(`${i + 1}. ${b.holderName} (${b.bankName})`, `bene_${b.id}`)]
            );
            buttons.push([Markup.button.callback('➕ Add New Account', 'new_account')]);
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
        } else {
            // No saved beneficiaries, ask for new one
            const msg = `
🏦 *Enter Bank Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

No saved accounts found.

Please enter your *10-digit bank account number*:
`;
            await ctx.replyWithMarkdown(msg);
            ctx.wizard.state.data.enteringNew = true;
        }
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 6: Handle Selection or Account Number Input
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;

            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }

            if (data === 'new_account') {
                await ctx.answerCbQuery();
                ctx.wizard.state.data.enteringNew = true;
                await ctx.replyWithMarkdown('📝 Enter your *10-digit bank account number*:');
                return;
            }

            if (data.startsWith('bene_')) {
                // User selected a saved beneficiary
                const beneId = parseInt(data.replace('bene_', ''));
                const beneficiaries = ctx.wizard.state.beneficiaries as Beneficiary[];
                const selected = beneficiaries.find((b: Beneficiary) => b.id === beneId);

                if (selected) {
                    await ctx.answerCbQuery(`Selected: ${selected.holderName}`);
                    ctx.wizard.state.data.selectedBeneficiary = selected;
                    ctx.wizard.state.data.accountNumber = selected.accountNumber;
                    ctx.wizard.state.data.bankCode = selected.bankCode;
                    ctx.wizard.state.data.holderName = selected.holderName;
                    ctx.wizard.state.data.bankName = selected.bankName;

                    // Skip to finalization
                    ctx.wizard.selectStep(7);
                    return ctx.wizard.steps[7](ctx);
                }
            }
            return;
        }

        // Text input - account number
        const accNum = ctx.message?.text?.trim();
        if (!accNum || !/^\d{10}$/.test(accNum)) {
            await ctx.replyWithMarkdown('⚠️ Please enter a valid *10-digit* account number.');
            return;
        }

        ctx.wizard.state.data.accountNumber = accNum;

        const msg = `
🏦 *Select Your Bank*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: \`${accNum}\`

Select your bank:
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [
                Markup.button.callback('GTBank', '058'),
                Markup.button.callback('First Bank', '011')
            ],
            [
                Markup.button.callback('Access Bank', '044'),
                Markup.button.callback('UBA', '033')
            ],
            [
                Markup.button.callback('Zenith Bank', '057'),
                Markup.button.callback('Fidelity', '070')
            ],
            [Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 7: Verify Account & Ask to Save
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;

            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }

            ctx.wizard.state.data.bankCode = data;
            ctx.wizard.state.data.bankName = BANK_MAP[data] || 'Bank';
            await ctx.answerCbQuery(`Selected ${ctx.wizard.state.data.bankName}`);
        }

        // If we already have holder name (from saved beneficiary), skip verification
        if (ctx.wizard.state.data.holderName) {
            // Directly proceed to initiation
            return ctx.wizard.steps[8](ctx);
        }

        try {
            await ctx.replyWithMarkdown('⏳ _Verifying account..._');

            const lookup = await switchService.lookupInstitution(
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.bankCode,
                ctx.wizard.state.data.accountNumber
            );

            ctx.wizard.state.data.holderName = lookup.account_name;

            const msg = `
✅ *Account Verified*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Name:* ${lookup.account_name}
🏦 *Bank:* ${ctx.wizard.state.data.bankName}
💳 *Account:* \`${ctx.wizard.state.data.accountNumber}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Would you like to save this account for future withdrawals?
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('💾 Save & Continue', 'save_yes')],
                [Markup.button.callback('➡️ Continue Without Saving', 'save_no')],
                [Markup.button.callback('❌ Cancel', 'cancel')]
            ]));
            return ctx.wizard.next();

        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error verifying account:* ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 8: Save Decision & Initiate
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;

            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }

            if (data === 'save_yes' && ctx.from) {
                // Save beneficiary
                storageService.addBeneficiary({
                    userId: ctx.from.id,
                    holderName: ctx.wizard.state.data.holderName,
                    bankCode: ctx.wizard.state.data.bankCode,
                    accountNumber: ctx.wizard.state.data.accountNumber,
                    bankName: ctx.wizard.state.data.bankName,
                    walletAddress: ''
                });
                await ctx.answerCbQuery('Account saved! ✅');
            } else {
                await ctx.answerCbQuery();
            }
        }

        try {
            await ctx.replyWithMarkdown('⏳ _Processing your order..._');

            const result = await switchService.initiateOfframp({
                amount: ctx.wizard.state.data.amount,
                country: ctx.wizard.state.data.country,
                asset: ctx.wizard.state.data.asset,
                currency: ctx.wizard.state.data.currency,
                beneficiary: {
                    bankCode: ctx.wizard.state.data.bankCode,
                    accountNumber: ctx.wizard.state.data.accountNumber,
                    holderName: ctx.wizard.state.data.holderName
                }
            });

            const chain = ctx.wizard.state.data.asset.split(':')[0];
            const chainName = chain === 'base' ? 'Base' : chain === 'ethereum' ? 'Ethereum' : chain === 'tron' ? 'Tron' : 'BSC';

            const msg = `
✅ *Order Created Successfully!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Reference:* \`${result.reference}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 *Send Crypto To:*

\`${result.deposit.address}\`

Network: *${chainName}*
Amount: *${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.assetName}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 *You Will Receive:*
₦${formatAmount(ctx.wizard.state.quote.destination.amount)} to ${ctx.wizard.state.data.holderName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Important:*
• Send the *exact amount* shown above
• Use the correct *${chainName}* network
• Funds will be sent automatically after confirmation

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

export { offrampWizard };
