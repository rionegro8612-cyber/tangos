-- 커뮤니티 MVP: uploads 테이블 삭제
-- 2025-01-XX

-- 트리거 삭제
DROP TRIGGER IF EXISTS trigger_uploads_updated_at ON uploads;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_uploads_updated_at();

-- 테이블 삭제
DROP TABLE IF EXISTS uploads;



















