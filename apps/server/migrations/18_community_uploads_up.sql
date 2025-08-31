-- 커뮤니티 MVP: uploads 테이블 생성
-- 2025-01-XX

-- 업로드 메타데이터 테이블
CREATE TABLE IF NOT EXISTS uploads (
  key text PRIMARY KEY,
  user_id user_id_t NOT NULL REFERENCES users(id),
  mime varchar(64),
  size int,
  status varchar(16) NOT NULL DEFAULT 'issued', -- issued|uploaded|linked
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_key ON uploads(key);
