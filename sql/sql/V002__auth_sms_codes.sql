-- V002__auth_sms_codes.sql
DROP TABLE IF EXISTS auth_sms_codes;
CREATE TABLE auth_sms_codes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  phone_e164_norm VARCHAR(20) NOT NULL,
  code_hash VARBINARY(64) NOT NULL,
  expire_at DATETIME NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  request_id VARCHAR(64) NOT NULL,
  ip_addr VARBINARY(16) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_expire (expire_at),
  INDEX idx_auth_phone (phone_e164_norm),
  INDEX idx_auth_req (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
