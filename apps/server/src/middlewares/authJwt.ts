import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { getAccessTokenFromCookies } from "../lib/cookies";
import { validate as uuidValidate } from "uuid";

export default async function authJwt(req: Request, res: Response, next: NextFunction) {
  try {
    // 1) 토큰 추출: Bearer 또는 쿠키(access_token)
    const header = req.headers.authorization || "";
    const m = header.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || getAccessTokenFromCookies(req.cookies);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, code: "NO_TOKEN", message: "missing bearer token" });
    }

    // 2) 검증 및 페이로드 파싱
    const payload: any = verifyToken(token); // { uid, jti, iat, exp, ... }
    const uid = String(payload?.uid ?? payload?.sub ?? payload?.userId ?? "");

    if (!uid || !uuidValidate(uid)) {
      return res
        .status(401)
        .json({ success: false, code: "BAD_TOKEN", message: "invalid payload or uid format" });
    }

    // 3) 통과 → req.user에 식별자 저장
    req.user = { id: uid };
    next();
  } catch (e: any) {
    return res
      .status(401)
      .json({ success: false, code: "BAD_TOKEN", message: e?.message || "invalid token" });
  }
}
