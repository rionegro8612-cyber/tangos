// ❌ export default 금지! 오직 아래 Named export만 있어야 함
export async function POST(req: Request) {
    try {
      const { phone } = await req.json();
      if (!phone || typeof phone !== "string") {
        return Response.json(
          { success: false, code: "INVALID_PHONE", message: "휴대폰 번호를 입력하세요" },
          { status: 400 }
        );
      }
      return Response.json({
        success: true,
        code: "OK",
        data: { expiresInSec: 180 },
        requestId: crypto.randomUUID(),
      });
    } catch {
      return Response.json(
        { success: false, code: "INVALID_BODY", message: "요청 본문이 올바른 JSON이 아닙니다" },
        { status: 400 }
      );
    }
  }