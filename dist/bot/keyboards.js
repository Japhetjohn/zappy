"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAIN_KEYBOARD = void 0;
const telegraf_1 = require("telegraf");
exports.MAIN_KEYBOARD = telegraf_1.Markup.inlineKeyboard([
    [
        telegraf_1.Markup.button.callback('💰 Buy Crypto', 'action_onramp'),
        telegraf_1.Markup.button.callback('💸 Sell Crypto', 'action_offramp')
    ],
    [
        telegraf_1.Markup.button.callback('🎁 My Points', 'action_points'),
        telegraf_1.Markup.button.callback('👥 My Referrals', 'action_referrals')
    ],
    [
        telegraf_1.Markup.button.callback('📂 Saved Accounts', 'action_beneficiaries'),
        telegraf_1.Markup.button.callback('📊 Rates', 'action_rates')
    ],
    [
        telegraf_1.Markup.button.callback('📜 History', 'action_history'),
        telegraf_1.Markup.button.callback('❓ Help & Info', 'action_help')
    ]
]);
//# sourceMappingURL=keyboards.js.map