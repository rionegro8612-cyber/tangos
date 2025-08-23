-- 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone_e164_norm VARCHAR(20) UNIQUE NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    region VARCHAR(100),
    birth_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_phone 
ON users(phone_e164_norm);

CREATE INDEX IF NOT EXISTS idx_users_nickname 
ON users(nickname);

-- 코멘트 추가
COMMENT ON TABLE users IS '사용자 기본 정보 테이블';
COMMENT ON COLUMN users.phone_e164_norm IS 'E.164 형식 전화번호';
COMMENT ON COLUMN users.nickname IS '사용자 닉네임';
COMMENT ON COLUMN users.region IS '사용자 지역';
COMMENT ON COLUMN users.birth_year IS '출생년도';
COMMENT ON COLUMN users.created_at IS '생성 시간';
COMMENT ON COLUMN users.updated_at IS '수정 시간';
