
-- Warning: will fail if any NULL nicknames exist
ALTER TABLE users
    ALTER COLUMN nickname SET NOT NULL;
