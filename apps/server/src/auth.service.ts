export async function verifyPhoneCode(phone: string, code: string) {
  console.log(`📨 인증 요청: phone=${phone}, code=${code}`);
  // 실제 DB 확인 로직은 여기
  return { userId: 'stub', isNew: false };
}
