import { Scenes, Markup } from 'telegraf';
import { switchService } from '../../services/switch';
import { storageService } from '../../services/storage';
import { Beneficiary } from '../../types';
import { formatAmount } from '../../utils';


const offrampWizard = new Scenes.WizardScene(
    'offramp-wizard',

    // ═══════════════════════════════════════════════════════════
    // Step 1: Asset Selection (Dynamic)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        ctx.wizard.state.data = {};
        try {
            await ctx.replyWithMarkdown('⏳ _Fetching available assets..._');
            const assets = await switchService.getAssets();
            ctx.wizard.state.assets = assets;

            const grouped: Record<string, any[]> = {};
            assets.forEach(a => {
                const chainName = a.blockchain.name;
                if (!grouped[chainName]) grouped[chainName] = [];
                grouped[chainName].push(a);
            });

            const msg = `
💸 *Sell Crypto*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the asset you want to sell:
`;
            const buttons = [];
            for (const [chain, chainAssets] of Object.entries(grouped)) {
                const row = chainAssets.map(a => Markup.button.callback(`${a.code} (${chain})`, `asset:${a.id}`));
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
            const coverage = await switchService.getCoverage('OFFRAMP');
            ctx.wizard.state.coverage = coverage;

            const msg = `
🌍 *Select Country*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selling: *${ctx.wizard.state.data.asset.code}* (${ctx.wizard.state.data.asset.blockchain.name})

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
💰 *Enter Amount*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selling: *${ctx.wizard.state.data.asset.code}*
Receiving: *${ctx.wizard.state.data.currency}*

Enter the amount of *${ctx.wizard.state.data.asset.code}* you want to sell:

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
        ctx.wizard.state.data.amount = amount;

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching best rates..._');

            const quote = await switchService.getOfframpQuote(
                amount,
                ctx.wizard.state.data.country,
                ctx.wizard.state.data.asset.id,
                ctx.wizard.state.data.currency
            );
            ctx.wizard.state.quote = quote;

            const msg = `
📊 *Quote Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *You Sell:* ${formatAmount(quote.source.amount)} ${ctx.wizard.state.data.asset.code}

💵 *You Get:* ${formatAmount(quote.destination.amount)} ${quote.destination.currency}

📈 *Rate:* 1 ${ctx.wizard.state.data.asset.code} = ${formatAmount(quote.rate)} ${quote.destination.currency}
${quote.fee ? `\n💳 *Fee:* ${formatAmount(quote.fee.total)} ${quote.fee.currency}\n` : ''}
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
    // Step 5: Beneficiary Selection or Dynamic Entry
    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // Step 5: Account Number Entry (or Select Saved)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') {
            await ctx.answerCbQuery('Cancelled');
            await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
            return ctx.scene.leave();
        }
        await ctx.answerCbQuery('Quote confirmed!');

        try {
            await ctx.replyWithMarkdown('⏳ _Preparing withdrawal..._');

            // Get saved beneficiaries
            const saved = ctx.from ? storageService.getBeneficiaries(ctx.from.id).filter(b => b.bankCode && b.accountNumber) : [];
            ctx.wizard.state.savedBeneficiaries = saved;
            ctx.wizard.state.data.beneficiary = {};

            let msg = `
🏦 *Withdrawal Details*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Enter your *Bank Account Number* below:

_Example: 0123456789_
`;
            let buttons: any[] = [];
            if (saved.length > 0) {
                msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Or select a saved account:*`;
                buttons = saved.slice(0, 5).map(b => [Markup.button.callback(`👤 ${b.holderName} (${b.bankName})`, `use_saved:${b.id}`)]);
            }
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
            return ctx.wizard.next();
        } catch (error: any) {
            await ctx.replyWithMarkdown(`❌ *Error:* ${error.message}`);
            return ctx.scene.leave();
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 6: Bank Selection (Fetches Banks)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        let accountNumber = '';

        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }
            if (data.startsWith('use_saved:')) {
                const id = parseInt(data.replace('use_saved:', ''));
                const selected = ctx.wizard.state.savedBeneficiaries.find((b: any) => b.id === id);
                if (selected) {
                    ctx.wizard.state.data.beneficiary = { ...selected };
                    // Skip to verification review (skip to step 7 logic)
                    ctx.wizard.selectStep(7);
                    return ctx.wizard.steps[7](ctx);
                }
            }
            return; // Ignore other callbacks
        }

        accountNumber = ctx.message?.text?.trim();
        if (!accountNumber || accountNumber.length < 5) {
            await ctx.replyWithMarkdown('⚠️ Please enter a valid account number.');
            return;
        }
        ctx.wizard.state.data.beneficiary.accountNumber = accountNumber;

        try {
            await ctx.replyWithMarkdown('⏳ _Fetching supported banks..._');
            // We use getInstitutions or requirements to show a list of banks
            const banks = await switchService.getInstitutions(ctx.wizard.state.data.country);
            ctx.wizard.state.banks = banks;

            const msg = `
🏦 *Select Your Bank*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: \`${accountNumber}\`

Choose your bank from the list below:
`;
            const buttons = [];
            for (let i = 0; i < banks.length; i += 2) {
                const row = [Markup.button.callback(banks[i].name, `bank:${banks[i].code}`)];
                if (banks[i + 1]) row.push(Markup.button.callback(banks[i + 1].name, `bank:${banks[i + 1].code}`));
                buttons.push(row);
            }
            buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons.slice(0, 50)));
            return ctx.wizard.next();
        } catch (e) {
            await ctx.replyWithMarkdown('❌ Error fetching banks. Please try again or type /cancel');
        }
    },

    // ═══════════════════════════════════════════════════════════
    // Step 7: Verification (Perform Individual Lookup)
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
                return ctx.scene.leave();
            }
            if (data.startsWith('bank:')) {
                const bankCode = data.replace('bank:', '');
                const bank = ctx.wizard.state.banks.find((b: any) => b.code === bankCode);
                ctx.wizard.state.data.beneficiary.bankCode = bankCode;
                ctx.wizard.state.data.beneficiary.bankName = bank.name;
                await ctx.answerCbQuery(`Selected ${bank.name}`);
            }
        }

        // Perform Mandatory Automated Lookup
        const b = ctx.wizard.state.data.beneficiary;
        if (!b.holderName && b.bankCode && b.accountNumber) {
            try {
                await ctx.replyWithMarkdown('⏳ _Automatically verifying account holder name..._');
                const result = await switchService.lookupInstitution(
                    ctx.wizard.state.data.country,
                    b.bankCode,
                    b.accountNumber
                );

                // Switch API might return fields in the 'data' or the 'result' directly (though switchService handles the data layer)
                // Let's be EXTREMELY exhaustive
                const possibleFields = ['account_name', 'accountName', 'name', 'holder_name', 'beneficiary_name', 'full_name'];
                let name = '';

                // Check flat
                for (const field of possibleFields) {
                    if (result[field]) {
                        name = result[field];
                        break;
                    }
                }

                // Check one level deep just in case
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
                    await ctx.replyWithMarkdown(`✅ *Account Verified:* ${name}`);
                } else {
                    console.error('Lookup succeeded but no name found in:', JSON.stringify(result));
                    throw new Error('Could not parse account name from response');
                }
            } catch (error: any) {
                console.error('Lookup failed:', error.message || error);
                await ctx.replyWithMarkdown('❌ *Verification Failed:* We could not automatically verify the account holder\'s name. Please ensure the account number and bank are correct.');
                // Go back to bank selection (Step 6) to allow correction
                ctx.wizard.selectStep(5);
                return ctx.wizard.steps[5](ctx);
            }
        }

        const msg = `
🏁 *Review Your Transfer*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Account Holder:* ${ctx.wizard.state.data.beneficiary.holderName}
🏦 *Bank:* ${ctx.wizard.state.data.beneficiary.bankName}
💳 *Account:* \`${ctx.wizard.state.data.beneficiary.accountNumber}\`
💸 *Amount to Sell:* ${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.asset.code}
💵 *You Will Receive:* ${formatAmount(ctx.wizard.state.quote.destination.amount)} ${ctx.wizard.state.data.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Would you like to proceed?
`;
        await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Yes, Create Wallet', 'initiate')],
            [Markup.button.callback('❌ Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    },

    // ═══════════════════════════════════════════════════════════
    // Step 8: Initiation & Wallet Creation
    // ═══════════════════════════════════════════════════════════
    async (ctx: any) => {
        if (!ctx.callbackQuery) return;
        const data = ctx.callbackQuery.data;
        if (data === 'cancel') {
            await ctx.answerCbQuery('Cancelled');
            await ctx.replyWithMarkdown('❌ *Transaction cancelled.*');
            return ctx.scene.leave();
        }

        try {
            await ctx.replyWithMarkdown('⏳ _Creating secure deposit wallet..._');

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

            // Save beneficiary for future use if it's new
            if (!ctx.wizard.state.data.beneficiary.id && ctx.from) {
                storageService.addBeneficiary({
                    userId: ctx.from.id,
                    holderName: ctx.wizard.state.data.beneficiary.holderName,
                    bankCode: ctx.wizard.state.data.beneficiary.bankCode,
                    accountNumber: ctx.wizard.state.data.beneficiary.accountNumber,
                    bankName: ctx.wizard.state.data.beneficiary.bankName
                });
            }

            const chainName = ctx.wizard.state.data.asset.blockchain.name;

            const msg = `
🚀 *Wallet Created Successfully!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Reference:* \`${result.reference}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 *Send EXACTLY:*
*${formatAmount(ctx.wizard.state.data.amount)} ${ctx.wizard.state.data.asset.code}*

📍 *Recipient Address:*
\`${result.deposit.address}\`

Network: *${chainName}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💵 *You Will Receive:*
${formatAmount(ctx.wizard.state.quote.destination.amount)} ${ctx.wizard.state.data.currency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Important:* 
Send funds only via the *${chainName}* network. Using any other network will result in permanent loss of funds.

💡 _After sending, you can monitor the status below:_
`;
            await ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([
                [Markup.button.callback('🔍 Track Status', `status_${result.reference}`)],
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
