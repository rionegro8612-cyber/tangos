-- V005__device_block_list.sql
DROP TABLE IF EXISTS device_block_list;
CREATE TABLE device_block_list (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  phone_e164_norm VARCHAR(20) NOT NULL,
  ip_addr VARBINARY(16) NULL,
  device_fingerprint VARCHAR(128) NULL,
  reason VARCHAR(255) NULL,
  blocked_until DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_block_phone (phone_e164_norm),
  INDEX idx_block_until (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
