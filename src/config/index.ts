import dotenv from 'dotenv';
dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN!,
  switch: {
    apiKey: process.env.SWITCH_API_KEY!,
    baseUrl: process.env.SWITCH_API_URL!,
  },
};
