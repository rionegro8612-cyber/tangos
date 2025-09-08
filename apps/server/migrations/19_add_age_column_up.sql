-- users 테이블에 age 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;

-- age 컬럼에 코멘트 추가
COMMENT ON COLUMN users.age IS '사용자 나이';








