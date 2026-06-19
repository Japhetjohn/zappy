-- Migration: Referral program
-- Run against bitnova.db

-- Add referral columns to users
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by INTEGER;
ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0;

-- Backfill referral codes for existing users
-- (In production, the application will also auto-generate codes on startup for any user missing one)
-- UPDATE users SET referral_code = UPPER(SUBSTR(HEX(RANDOMBLOB(3)), 1, 6)) WHERE referral_code IS NULL;
