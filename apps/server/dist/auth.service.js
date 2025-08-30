"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneCode = verifyPhoneCode;
async function verifyPhoneCode(phone, code) {
    console.log(`📨 인증 요청: phone=${phone}, code=${code}`);
    // 실제 DB 확인 로직은 여기
    return { userId: "stub", isNew: false };
}
