-- Remove original_password column from users table safely
ALTER TABLE users DROP COLUMN IF EXISTS original_password;

-- Ensure settings table has the general_password
INSERT INTO settings (key, value, created_at, updated_at)
VALUES ('general_password', 'swimtrack2024', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;
