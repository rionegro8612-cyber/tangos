/**
 * 전화번호를 E.164 형식으로 정규화
 * @param phone 전화번호 (01012345678, +821012345678, 821012345678 등)
 * @returns E.164 형식 전화번호 (+821012345678)
 */
export function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82")) {
    return "+" + digits;
  } else if (digits.startsWith("0")) {
    return "+82" + digits.slice(1);
  } else if (!digits.startsWith("+")) {
    return "+82" + digits;
  }
  return phone;
}

/**
 * 한국 전화번호 정규화 (기존 호환성)
 * @deprecated normalizeE164 사용 권장
 */
export function normalizeKrPhone(input: string): string {
  return normalizeE164(input);
}
