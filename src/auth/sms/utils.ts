export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function validatePhoneNumber(phone: string): boolean {
  // 한국 휴대폰 번호 형식 검증 (010-XXXX-XXXX)
  const phoneRegex = /^010-\d{4}-\d{4}$/;
  return phoneRegex.test(phone);
}

export function formatPhoneNumber(phone: string): string {
  // 하이픈 제거 후 010-XXXX-XXXX 형식으로 변환
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('010')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}



