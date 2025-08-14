CREATE TABLE IF NOT EXISTS device_block_list (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    reason TEXT,
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_block_list_device_id
    ON device_block_list (device_id);
