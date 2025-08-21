-- Phone number encryption rollback

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_encrypt_phone_number ON users;

-- Drop the function
DROP FUNCTION IF EXISTS encrypt_phone_number();

-- Note: phone_enc column data will remain but will no longer be automatically updated
