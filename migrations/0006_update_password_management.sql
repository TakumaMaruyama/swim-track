-- Rename original_password column in users table to password
ALTER TABLE users RENAME COLUMN original_password TO password;

-- Update the settings table to ensure general_password exists
INSERT INTO settings (key, value, created_at, updated_at)
VALUES ('general_password', 'swimtrack2024', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;
