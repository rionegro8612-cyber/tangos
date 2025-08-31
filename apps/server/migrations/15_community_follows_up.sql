-- 커뮤니티 MVP: follows 및 blocks 테이블 생성
-- 2025-01-XX

-- 팔로우 테이블
CREATE TABLE IF NOT EXISTS follows (
  follower_id user_id_t NOT NULL REFERENCES users(id),
  followee_id user_id_t NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower_id, followee_id)
);

-- 차단 테이블
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id user_id_t NOT NULL REFERENCES users(id),
  blocked_id user_id_t NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id, blocked_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id, created_at DESC);
