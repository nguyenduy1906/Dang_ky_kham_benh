-- Run in a transaction. Add the field required by current public directory APIs.
-- Keep legacy doctor_profile.avatar_url and preserve any existing user avatar.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

UPDATE users AS u
SET avatar_url = to_jsonb(d)->>'avatar_url'
FROM doctor_profile AS d
WHERE d.user_id = u.user_id
  AND NULLIF(trim(u.avatar_url), '') IS NULL
  AND NULLIF(trim(to_jsonb(d)->>'avatar_url'), '') IS NOT NULL;
