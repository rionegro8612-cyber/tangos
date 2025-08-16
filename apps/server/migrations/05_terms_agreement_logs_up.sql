CREATE TABLE IF NOT EXISTS terms_agreement_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    term_code TEXT NOT NULL,
    version TEXT NOT NULL,
    agreed BOOLEAN NOT NULL,
    agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terms_logs_user_term
    ON terms_agreement_logs (user_id, term_code);
