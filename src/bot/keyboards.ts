import { Markup } from 'telegraf';

export const MAIN_KEYBOARD = Markup.inlineKeyboard([
    [
        Markup.button.callback('💰 Buy Crypto', 'action_onramp'),
        Markup.button.callback('💸 Sell Crypto', 'action_offramp')
    ],
    [
        Markup.button.callback('📂 Saved Accounts', 'action_beneficiaries'),
        Markup.button.callback('📊 Rates', 'action_rates'),
        Markup.button.callback('📜 History', 'action_history')
    ],
    [
        Markup.button.callback('❓ Help & Info', 'action_help')
    ]
]);
