-- 커뮤니티 MVP: hashtags 및 post_hashtags 테이블 생성
-- 2025-01-XX

-- 해시태그 테이블
CREATE TABLE IF NOT EXISTS hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag varchar(64) NOT NULL UNIQUE
);

-- 게시글-해시태그 연결 테이블
CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id),
  PRIMARY KEY(post_id, hashtag_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_post_hashtags_tag ON post_hashtags(post_id, hashtag_id);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag);
