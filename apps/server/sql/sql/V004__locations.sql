-- V004__locations.sql
DROP TABLE IF EXISTS locations;
CREATE TABLE locations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  region_code VARCHAR(16) NOT NULL,
  region_name VARCHAR(100) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  provider VARCHAR(32) NOT NULL, -- kakao | vworld | manual
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_region_code (region_code),
  INDEX idx_locations_latlng (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
