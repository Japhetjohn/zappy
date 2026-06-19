-- Migration: Points loyalty program + fee reduction to 1%
-- Run against bitnova.db

-- Add points balance to users
ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0;

-- Add point tracking to transactions
ALTER TABLE transactions ADD COLUMN points_earned INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN points_redeemed INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN points_discount_pct REAL DEFAULT 0;

-- Update platform fee setting from 4.5% to 1%
UPDATE settings SET value = '1' WHERE key = 'platform_fee' AND value IN ('4.5', '4.50');

-- Add points program settings (1 point = 0.1% bonus, max 5 points = 0.5% total bonus)
INSERT OR IGNORE INTO settings (key, value) VALUES ('points_per_tx', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('points_value_pct', '0.1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_points_per_tx', '5');

-- Optional: backfill points for historical completed transactions
-- UPDATE users SET points = (
--     SELECT COUNT(*) FROM transactions
--     WHERE transactions.user_id = users.id AND status = 'COMPLETED'
-- );
-- UPDATE transactions SET points_earned = 1 WHERE status = 'COMPLETED' AND points_earned = 0;
