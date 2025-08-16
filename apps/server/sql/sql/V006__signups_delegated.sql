-- V006__signups_delegated.sql
DROP TABLE IF EXISTS signups_delegated;
CREATE TABLE signups_delegated (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  inviter_user_id BIGINT UNSIGNED NULL,
  invite_token CHAR(36) NOT NULL,
  phone_e164_norm VARCHAR(20) NOT NULL,
  status ENUM('pending','completed','expired') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  UNIQUE KEY uk_invite_token (invite_token),
  INDEX idx_delegate_phone (phone_e164_norm),
  FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
