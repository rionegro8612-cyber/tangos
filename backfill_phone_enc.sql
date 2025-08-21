UPDATE users
SET phone_enc = pgp_sym_encrypt(phone_e164_norm, :'ENC_KEY')
WHERE phone_enc IS NULL;
