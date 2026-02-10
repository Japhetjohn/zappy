# Telegram Bot Setup Guide - Bitnova Africa

This guide provides all the information you need to configure your Telegram bot profile via **@BotFather**.

---

## 🤖 Bot Information

**Bot Username:** `@bitnova_africa_bot`

---

## 📝 Bot Profile Configuration

### 1. Bot Name
```
Bitnova Africa
```

### 2. Bot Description (Short - shown in chat list)
```
Your friendly crypto assistant for buying and selling digital assets in Africa. Fast, secure, and automated.
```

### 3. About Text (Detailed - shown in bot profile)
```
Bitnova Africa makes crypto trading simple and accessible across the continent.

💰 Buy Crypto - Get digital assets sent directly to your wallet
💸 Sell Crypto - Turn your crypto into cash in your bank account

We support multiple cryptocurrencies and networks, with competitive rates and instant processing. Your transactions are secure, automated, and tracked in real-time.

Ready to get started? Just tap /start!
```

### 4. Bot Commands
Set these commands via `/setcommands` in BotFather:

```
start - Launch Bitnova Africa and see main menu
onramp - Buy crypto with local currency
offramp - Sell crypto for local currency
stats - View platform statistics (admin only)
help - Get help and support information
```

---

## 🎨 Optional Enhancements

### Bot Profile Photo
- Use a professional logo with the Bitnova Africa branding
- Recommended size: 512x512 pixels
- Format: PNG with transparent background

### Bot About Picture
- A banner showcasing your services
- Recommended size: 640x360 pixels

---

## 🔧 How to Apply These Settings

1. Open Telegram and search for **@BotFather**
2. Send `/mybots` and select your bot
3. Choose **Edit Bot** and apply the settings above:
   - **Edit Name** → Paste the Bot Name
   - **Edit Description** → Paste the Bot Description
   - **Edit About** → Paste the About Text
   - **Edit Commands** → Paste all commands at once
   - **Edit Botpic** → Upload your logo (optional)

---

## ✅ Verification

After setup, your bot profile should look professional and clearly communicate:
- What the bot does (crypto trading)
- Who it serves (African users)
- How to get started (/start command)

Your bot is now live at: **https://t.me/bitnova_africa_bot**

---

## 🚀 Current Status

- ✅ Bot deployed to production server (72.61.97.210)
- ✅ PM2 auto-restart enabled
- ✅ 5-minute heartbeat active
- ✅ Database schema updated
- ✅ All navigation buttons working

**Note:** The heartbeat logs appear at DEBUG level. To see them in PM2 logs, you can temporarily set the log level to 'debug' in your logger configuration, or they will appear in your application's debug logs.
