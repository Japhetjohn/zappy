"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    botToken: process.env.BOT_TOKEN,
    telegramProxy: process.env.TELEGRAM_PROXY,
    switch: {
        apiKey: process.env.SWITCH_API_KEY,
        baseUrl: process.env.SWITCH_API_URL,
        webhookSecret: process.env.SWITCH_WEBHOOK_SECRET,
    },
    developerFee: Number(process.env.DEVELOPER_FEE) || 1,
    developerWallet: process.env.DEVELOPER_WALLET || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV',
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL,
};
//# sourceMappingURL=index.js.map