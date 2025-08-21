-- Phone number encryption setup
-- This migration sets up automatic phone number encryption using pgcrypto

-- Create function to encrypt phone numbers
CREATE OR REPLACE FUNCTION encrypt_phone_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt phone_e164_norm if it's being inserted or updated
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.phone_e164_norm IS NOT NULL THEN
            NEW.phone_enc = pgp_sym_encrypt(NEW.phone_e164_norm, current_setting('app.phone_enc_key'));
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically encrypt phone numbers
DROP TRIGGER IF EXISTS trigger_encrypt_phone_number ON users;
CREATE TRIGGER trigger_encrypt_phone_number
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_phone_number();

-- Set the encryption key (this should be set in environment)
-- ALTER DATABASE tango SET app.phone_enc_key = 'your-32-byte-secret-key';
