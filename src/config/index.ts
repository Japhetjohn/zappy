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
  port: process.env.PORT || 3000,
};
