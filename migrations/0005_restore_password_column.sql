-- 一時的なデフォルト値付きでパスワードカラムを追加
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text DEFAULT 'temporary_password_please_change';

-- NOT NULL制約を追加
ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;

-- デフォルト値を削除
ALTER TABLE "users" ALTER COLUMN "password" DROP DEFAULT;
