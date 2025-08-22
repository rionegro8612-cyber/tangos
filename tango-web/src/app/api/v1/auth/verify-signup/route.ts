import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { 
      phone, 
      carrier, 
      code, 
      name, 
      birthdate, 
      gender, 
      agreements 
    } = await req.json();
    
    console.log("[verify-signup] received request:", { phone, carrier, code, name, birthdate, gender, agreements });
    
    // 필수 필드 검증
    if (!phone || !carrier || !code || !name || !birthdate || !gender || !agreements) {
      return NextResponse.json({ 
        success: false, 
        code: "MISSING_FIELDS", 
        message: "모든 필수 정보를 입력해주세요.", 
        data: null 
      }, { status: 400 });
    }

    // 약관 동의 검증
    if (!agreements.tos || !agreements.privacy || !agreements.age14) {
      return NextResponse.json({ 
        success: false, 
        code: "TERMS_NOT_AGREED", 
        message: "필수 약관에 동의해주세요.", 
        data: null 
      }, { status: 400 });
    }

    // 성별 검증
    if (!["M", "F"].includes(gender)) {
      return NextResponse.json({ 
        success: false, 
        code: "INVALID_GENDER", 
        message: "올바른 성별을 선택해주세요.", 
        data: null 
      }, { status: 400 });
    }

    // 생년월일 형식 검증 (YYYY-MM-DD)
    const birthRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthRegex.test(birthdate)) {
      return NextResponse.json({ 
        success: false, 
        code: "INVALID_BIRTHDATE", 
        message: "올바른 생년월일 형식으로 입력해주세요.", 
        data: null 
      }, { status: 400 });
    }

    // 생년월일 유효성 검증 (미래 날짜 불가, 1900년 이전 불가)
    const birthDate = new Date(birthdate);
    const today = new Date();
    const minDate = new Date('1900-01-01');
    
    if (birthDate > today) {
      return NextResponse.json({ 
        success: false, 
        code: "FUTURE_BIRTHDATE", 
        message: "미래 날짜는 입력할 수 없습니다.", 
        data: null 
      }, { status: 400 });
    }
    
    if (birthDate < minDate) {
      return NextResponse.json({ 
        success: false, 
        code: "INVALID_BIRTHDATE", 
        message: "올바른 생년월일을 입력해주세요.", 
        data: null 
      }, { status: 400 });
    }

    // 14세 이상 검증
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 14) {
      return NextResponse.json({ 
        success: false, 
        code: "UNDER_AGE", 
        message: "14세 이상만 가입할 수 있습니다.", 
        data: null 
      }, { status: 400 });
    }

    // OTP 코드 검증 (개발 환경에서는 123456 허용)
    const isValidCode = process.env.NODE_ENV !== "production" ? 
      (code === "123456") : 
      (code === "123456"); // TODO: 실제 OTP 검증 로직 구현
    
    if (!isValidCode) {
      return NextResponse.json({ 
        success: false, 
        code: "INVALID_CODE", 
        message: "인증번호가 올바르지 않습니다.", 
        data: null 
      }, { status: 400 });
    }

    // TODO: 실제 회원가입 로직 구현
    // - 중복 계정 확인 (phone 고유)
    // - 유저 생성
    // - 인증 세션 발급
    // - OTP 소거 (재사용 방지)
    // - 감사 로그

    // 임시 성공 응답 (개발용)
    const mockUserId = "user_" + Date.now();
    const mockAccessToken = "access_" + Math.random().toString(36).substr(2, 9);
    const mockRefreshToken = "refresh_" + Math.random().toString(36).substr(2, 9);

    console.log("[verify-signup] success:", { userId: mockUserId, name });

    return NextResponse.json({ 
      success: true, 
      message: "SIGNUP_OK", 
      data: {
        userId: mockUserId,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        profile: { name }
      }
    }, {
      headers: {
        'Set-Cookie': [
          `access_token=${mockAccessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
          `refresh_token=${mockRefreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`
        ]
      }
    });
    
  } catch (error) {
    console.error("[verify-signup] error:", error);
    return NextResponse.json({ 
      success: false, 
      code: "SERVER_ERROR", 
      message: "서버 오류가 발생했습니다.", 
      data: null 
    }, { status: 500 });
  }
}
