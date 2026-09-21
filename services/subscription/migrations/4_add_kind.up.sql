ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'subscription';

ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_kind_check
    CHECK (kind IN ('subscription', 'node'));
