-- V003__terms_agreement_logs.sql
DROP TABLE IF EXISTS terms_agreement_logs;
CREATE TABLE terms_agreement_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  terms_code VARCHAR(64) NOT NULL,
  version VARCHAR(32) NOT NULL,
  agreed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_addr VARBINARY(16) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_terms_user (user_id),
  INDEX idx_terms_code (terms_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
