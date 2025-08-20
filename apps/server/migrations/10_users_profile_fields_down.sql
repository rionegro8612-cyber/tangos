-- 004_users_profile_fields.sql (DOWN)
-- users 테이블에서 지역 좌표 필드만 제거

-- 좌표 인덱스 제거
DROP INDEX IF EXISTS idx_users_region_coords;

-- 좌표 컬럼만 제거 (기존 필드들은 유지)
ALTER TABLE users
  DROP COLUMN IF EXISTS region_lng,
  DROP COLUMN IF EXISTS region_lat;
