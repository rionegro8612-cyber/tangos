CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION fill_phone_enc() RETURNS trigger AS $BODY$
DECLARE
  v_key text := current_setting('app.phone_enc_key', true);
BEGIN
  IF NEW.phone_enc IS NULL THEN
    IF v_key IS NULL THEN
      RAISE EXCEPTION 'app.phone_enc_key is not set';
    END IF;
    NEW.phone_enc := pgp_sym_encrypt(NEW.phone_e164_norm, v_key);
  END IF;
  RETURN NEW;
END
$BODY$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_phone_enc ON users;
CREATE TRIGGER trg_fill_phone_enc
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fill_phone_enc();
