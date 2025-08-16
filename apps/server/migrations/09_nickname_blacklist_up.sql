CREATE TABLE IF NOT EXISTS nickname_blacklist (
    id BIGSERIAL PRIMARY KEY,
    pattern TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nickname_blacklist_pattern
    ON nickname_blacklist (pattern);
