-- 커뮤니티 MVP: posts 및 post_images 테이블 삭제
-- 2025-01-XX

-- 트리거 삭제
DROP TRIGGER IF EXISTS trigger_posts_updated_at ON posts;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_posts_updated_at();

-- 테이블 삭제 (순서 중요: 외래키 참조 순서 고려)
DROP TABLE IF EXISTS post_images;
DROP TABLE IF EXISTS posts;



