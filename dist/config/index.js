"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
exports.config = {
    botToken: requireEnv('BOT_TOKEN'),
    telegramProxy: process.env.TELEGRAM_PROXY,
    switch: {
        apiKey: requireEnv('SWITCH_API_KEY'),
        baseUrl: requireEnv('SWITCH_API_URL'),
        webhookSecret: requireEnv('SWITCH_WEBHOOK_SECRET'),
    },
    developerFee: Number(process.env.DEVELOPER_FEE) || 1,
    developerWallet: requireEnv('DEVELOPER_WALLET'),
    adminPassword: requireEnv('ADMIN_PASSWORD'),
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL,
    points: {
        perTx: Number(process.env.POINTS_PER_TX) || 1,
        valuePct: Number(process.env.POINTS_VALUE_PCT) || 0.1,
        maxPerTx: Number(process.env.MAX_POINTS_PER_TX) || 5,
    },
};
//# sourceMappingURL=index.js.map