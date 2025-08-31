-- 커뮤니티 MVP: posts 및 post_images 테이블 생성
-- 2025-01-XX

-- 게시글 테이블
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id user_id_t NOT NULL REFERENCES users(id),
  content text,
  location_code varchar(10),
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  images_count int NOT NULL DEFAULT 0,
  visibility varchar(16) NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 게시글 이미지 테이블
CREATE TABLE IF NOT EXISTS post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url text NOT NULL,
  key text NOT NULL,
  width int,
  height int,
  ord int NOT NULL DEFAULT 0
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(location_code) WHERE location_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images(post_id, ord);

-- 트리거 함수: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();
