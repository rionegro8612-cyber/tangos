-- Administrative region code dictionary (KR)
CREATE TABLE IF NOT EXISTS locations (
    code VARCHAR(10) PRIMARY KEY,
    sido VARCHAR(50),
    sigungu VARCHAR(50),
    eupmyeondong VARCHAR(50),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
