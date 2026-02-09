import { Markup } from 'telegraf';

export const MAIN_KEYBOARD = Markup.inlineKeyboard([
    [
        Markup.button.callback('💰 Buy Crypto', 'action_onramp'),
        Markup.button.callback('💸 Sell Crypto', 'action_offramp')
    ],
    [
        Markup.button.callback('📂 Saved Accounts', 'action_beneficiaries'),
        Markup.button.callback('📊 Status', 'status')
    ],
    [
        Markup.button.callback('❓ Help & Info', 'action_help')
    ]
]);
