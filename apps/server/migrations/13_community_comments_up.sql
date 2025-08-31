-- 커뮤니티 MVP: comments 테이블 생성
-- 2025-01-XX

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id user_id_t NOT NULL REFERENCES users(id),
  parent_comment_id uuid REFERENCES comments(id),
  content text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- 트리거 함수: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();
