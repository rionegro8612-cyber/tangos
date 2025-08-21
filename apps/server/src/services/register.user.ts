
import { query } from "../db";

type CreateUserInput = {
  phone: string;
  name: string;
  birth: string;  // YYYYMMDD
  gender: string | null;
  carrier: string;
  consent: { tos: boolean; privacy: boolean; marketing?: boolean };
  kycProvider: string;
};

/** minimal user creation compatible with existing users schema */
export async function createUserWithKyc(input: CreateUserInput): Promise<string> {
  const rows = await query<{ id: string }>(`
    INSERT INTO users (phone_e164_norm, is_verified, kyc_verified, kyc_provider, kyc_checked_at, birth_date, age, created_at, updated_at)
    VALUES ($1, TRUE, TRUE, $2, NOW(), to_date($3,'YYYYMMDD'), EXTRACT(YEAR FROM AGE(to_date($3,'YYYYMMDD'))), NOW(), NOW())
    RETURNING id
  `, [input.phone, input.kycProvider, input.birth]);
  const id = rows[0].id;

  // Store consents (simple log table already exists in repo)
  await query(`
    INSERT INTO terms_agreement_logs (user_id, tos, privacy, marketing, created_at)
    VALUES ($1::uuid, $2, $3, $4, NOW())
  `, [id, input.consent.tos, input.consent.privacy, !!input.consent.marketing]);

  return id;
}

export async function findByPhone(phone: string) {
  const rows = await query<{ id: string }>(`SELECT id FROM users WHERE phone_e164_norm = $1`, [phone]);
  return rows[0]?.id ?? null;
}
