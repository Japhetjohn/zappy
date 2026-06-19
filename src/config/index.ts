import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  telegramProxy: process.env.TELEGRAM_PROXY,
  switch: {
    apiKey: requireEnv('SWITCH_API_KEY'),
    baseUrl: requireEnv('SWITCH_API_URL'),
    webhookSecret: requireEnv('SWITCH_WEBHOOK_SECRET'),
  },
  // Platform fee passed to Switch as developer_fee. Kept at 1% for the points/bonus program.
  developerFee: Number(process.env.DEVELOPER_FEE) || 1,
  developerWallet: requireEnv('DEVELOPER_WALLET'),
  adminPassword: requireEnv('ADMIN_PASSWORD'),
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL,
  // Points program settings
  // Each point gives a small bonus; total bonus is capped at 0.5% per transaction.
  points: {
    perTx: Number(process.env.POINTS_PER_TX) || 1,
    valuePct: Number(process.env.POINTS_VALUE_PCT) || 0.1,
    maxPerTx: Number(process.env.MAX_POINTS_PER_TX) || 5,
  },
};
