-- Refresh 토큰 관리 테이블 생성
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL, -- SHA256 해시
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    user_agent TEXT NULL,
    ip_addr INET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_token_hash ON auth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at ON auth_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked_at ON auth_refresh_tokens(revoked_at);

-- 유니크 제약 (사용자당 활성 토큰은 하나만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_refresh_tokens_active_user 
ON auth_refresh_tokens(user_id) 
WHERE revoked_at IS NULL;

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auth_refresh_tokens_updated_at 
    BEFORE UPDATE ON auth_refresh_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();














