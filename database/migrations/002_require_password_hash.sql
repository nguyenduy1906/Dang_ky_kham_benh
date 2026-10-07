-- Không thay mật khẩu của tài khoản đã có hash hợp lệ.
-- Tài khoản thiếu/rỗng/hash mẫu cũ được khóa và cần đặt lại mật khẩu.
BEGIN;
SELECT pg_advisory_xact_lock(78124001);
UPDATE users
SET password_hash = 'scrypt:32768:8:1$W3XT00761UBAvfEt$a9304ca38d0c3ba4527dcfc9eebab95d3b1f8d85f721eef01b59ddeb2d2c7f3335073313bbf74e723b9623971bf7a9415126eddd5e279c6b9c5fc8aa297abb51', account_status = 'LOCKED'
WHERE password_hash IS NULL OR trim(password_hash) = '' OR password_hash LIKE 'demo\_hash\_%' ESCAPE '\';
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_password_hash_nonempty') THEN
        ALTER TABLE users ADD CONSTRAINT users_password_hash_nonempty CHECK (trim(password_hash) <> '');
    END IF;
END;
$$;
COMMIT;
