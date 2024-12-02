-- Modify users table to remove password column
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Note: settingsテーブルは変更せず、一般ユーザー用の共通パスワードシステムを維持
