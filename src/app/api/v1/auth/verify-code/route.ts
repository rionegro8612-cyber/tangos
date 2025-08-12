// ❌ export default 금지! 오직 아래 Named export만 있어야 함
export async function POST(req: Request) {
    try {
      const { phone, code } = await req.json();
      if (!phone || !code) {
        return Response.json(
          { success: false, code: "MISSING_PARAMS", message: "phone과 code를 모두 보내세요" },
          { status: 400 }
        );
      }
  
      if (code === "123456") {
        return Response.json({
          success: true,
          code: "OK",
          data: {
            accessToken: "demo-access-token",
            refreshToken: "demo-refresh-token",
            userId: "user_demo_1",
          },
          requestId: crypto.randomUUID(),
        });
      }
  
      return Response.json(
        { success: false, code: "INVALID_CODE", message: "인증번호가 올바르지 않습니다" },
        { status: 401 }
      );
    } catch {
      return Response.json(
        { success: false, code: "INVALID_BODY", message: "요청 본문이 올바른 JSON이 아닙니다" },
        { status: 400 }
      );
    }
  }
  