ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_kind_check;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS kind;
