-- 커뮤니티 MVP: likes 테이블 생성
-- 2025-01-XX

-- 게시글 좋아요 테이블
CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id user_id_t NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id, user_id)
);

-- 댓글 좋아요 테이블
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id user_id_t NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(comment_id, user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id, created_at DESC);
