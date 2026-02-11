import dotenv from 'dotenv';
dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN!,
  telegramProxy: process.env.TELEGRAM_PROXY,
  switch: {
    apiKey: process.env.SWITCH_API_KEY!,
    baseUrl: process.env.SWITCH_API_URL!,
    webhookSecret: process.env.SWITCH_WEBHOOK_SECRET!,
  },
  developerFee: Number(process.env.DEVELOPER_FEE) || 1,
  developerWallet: process.env.DEVELOPER_WALLET || 'GMaeFMXrbxTfS2e83B92YticnGYKdF4DaG5FWjL25tNV',
  adminPassword: process.env.ADMIN_PASSWORD || 'kuulsinim45',
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL,
};
