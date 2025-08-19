
ALTER TABLE users
    DROP COLUMN IF EXISTS region_code,
    DROP COLUMN IF EXISTS region_label;
