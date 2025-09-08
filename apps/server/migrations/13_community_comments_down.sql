-- 커뮤니티 MVP: comments 테이블 삭제
-- 2025-01-XX

-- 트리거 삭제
DROP TRIGGER IF EXISTS trigger_comments_updated_at ON comments;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_comments_updated_at();

-- 테이블 삭제
DROP TABLE IF EXISTS comments;











