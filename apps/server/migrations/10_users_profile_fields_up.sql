-- 004_users_profile_fields.sql (UP)
-- users 테이블에 누락된 지역 좌표 필드만 추가

-- 기존 필드들은 이미 존재함 (nickname, region_code, region_label)
-- 좌표 필드만 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS region_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS region_lng NUMERIC(10,6);

-- 지역 좌표 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_region_coords ON users(region_lat, region_lng);

-- 기존 데이터 확인 (디버깅용)
-- SELECT COUNT(*) as total_users, 
--        COUNT(nickname) as with_nickname,
--        COUNT(region_code) as with_region_code,
--        COUNT(region_label) as with_region_label,
--        COUNT(region_lat) as with_region_lat,
--        COUNT(region_lng) as with_region_lng
-- FROM users;
