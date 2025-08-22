import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, carrier, context } = await req.json();
    
    if (!phone) {
      return NextResponse.json({ 
        success: false, 
        code: "BAD_REQUEST", 
        message: "phone required", 
        data: null 
      }, { status: 400 });
    }

    if (!carrier) {
      return NextResponse.json({ 
        success: false, 
        code: "BAD_REQUEST", 
        message: "carrier required", 
        data: null 
      }, { status: 400 });
    }

    if (context !== "signup") {
      return NextResponse.json({ 
        success: false, 
        code: "INVALID_CONTEXT", 
        message: "context must be 'signup'", 
        data: null 
      }, { status: 400 });
    }

    // TODO: 실제 SMS 발송 로직 구현
    // - rate limit 체크 (번호당 1분 1회, 하루 5회)
    // - 이미 가입된 번호인지 확인
    // - OTP 코드 생성 및 저장
    
    // 개발 환경에서는 devCode 반환
    const devCode = process.env.NODE_ENV !== "production" ? "123456" : undefined;
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        phoneE164: phone, 
        expiresInSec: 180, 
        devCode 
      } 
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      code: "SERVER_ERROR", 
      message: "서버 오류가 발생했습니다.", 
      data: null 
    }, { status: 500 });
  }
}
