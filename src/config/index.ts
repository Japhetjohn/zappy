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
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/zappy',
  port: process.env.PORT || 3000,
};
