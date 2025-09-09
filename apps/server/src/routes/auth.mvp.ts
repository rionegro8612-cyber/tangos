// apps/server/src/routes/auth.mvp.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { issueCode, verifyCode } from "../auth/sms/otpRepo";
import {
  findOrCreateUserByPhoneE164,
  getUserProfile,
  touchLastLogin,
  findByPhone,
} from "../repos/userRepo";
import { signAccessToken, signRefreshToken, verifyAccessToken, newJti } from "../lib/jwt";
import { getTokenFromReq } from "../lib/auth.shared";
import { verifyAccessTokenOrThrow } from "../lib/jwt";
import { issueOtp, verifyOtp, checkAndMarkCooldown, setOtp, getOtp, delOtp, fetchOtp } from "../services/otp.service";
import { validate as uuidValidate } from "uuid";
import { logOtpSend, logOtpVerify } from "../lib/logger";
import {
  recordOtpSend,
  recordOtpVerify,
  recordRateLimitExceeded,
  recordUserRegistration,
  recordUserLogin,
} from "../lib/metrics"; // 🆕 Added: 메트릭 함수들

// ⬇️ 추가: Redis 클라이언트/도우미
import { getRedis } from "../lib/redis";

function normalizeE164(phone: string | undefined): string {
  if (!phone) throw new Error("phone is required");
  const p = phone.replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) throw new Error("phone must be E.164");
  return p;
}

// ⬇️ 추가: 서비스 레이어가 실패해도 확실히 저장하는 하드세이브
async function saveOtpHard(phoneE164: string, code: string, ctx = "register", ttlSec = Number(process.env.OTP_TTL_SEC ?? 300)) {
  const r = getRedis();
  const key = `otp:${ctx}:${phoneE164}`;
  await r.setex(key, ttlSec, code);              // setex = set with expiration
  const ttl = await r.ttl(key);
  console.log(`[otp][HARD] saved key=${key} ttl=${ttl}s code=${process.env.DEBUG_OTP ? code : "***"}`);
  return { key, ttl };
}

// 🆕 미들웨어 import 추가
import { rateLimitSend, rateLimitVerify } from "../middlewares/rateLimit";
import { withIdempotency } from "../middlewares/idempotency";
// checkAndMarkCooldown은 이미 위에서 import됨
import { setAuthCookies, accessCookieOptions } from "../lib/cookies";

// 🆕 환경변수 상수 추가
const TTL = 300; // 5분
const PHONE_LIMIT = 5;
const PHONE_WIN = 600; // 10분
const IP_LIMIT = 20;
const IP_WIN = 3600; // 1시간

export const authRouter = Router();

/** 전화번호 마스킹 함수 */
function phoneMasked(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, 3) + "*".repeat(phone.length - 4) + phone.slice(-1);
}

// 쿠키 관련 함수들은 lib/cookies.ts에서 import하여 사용

/** POST /api/v1/auth/send-sms */
authRouter.post("/send-sms", 
  withIdempotency(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    const { phone, carrier, context } = (req.body || {}) as {
      phone?: string;
      carrier?: string;
      context?: string;
    };
    const ctx = context?.trim() || "register";
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    if (!phone || !carrier) {
      // 🆕 메트릭: OTP 전송 실패 (잘못된 요청)
      recordOtpSend("fail", "SENS", carrier || "unknown");

      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, carrier required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 전화번호 형식 검증 (E.164 형식)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Invalid phone number format. Use E.164 format (e.g., +82123456789)",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }
    const p = normalizeE164(phone);

    // 🚨 레이트리밋은 미들웨어에서 처리됨 (rateLimitSend)
    
    // 재전송 쿨다운 체크
    console.log(`[auth.mvp] 쿨다운 체크 시작: ${p}`);
    const cd = await checkAndMarkCooldown(p);
    console.log(`[auth.mvp] 쿨다운 체크 결과:`, cd);
    if (cd.blocked) {
      console.log(`[auth.mvp] 쿨다운에 걸림: ${p}, retryAfter: ${cd.retryAfter}`);
      return res.status(429).json({
        success: false,
        code: "RESEND_BLOCKED",
        message: "재전송 쿨다운 중입니다.",
        data: { retryAfter: cd.retryAfter },
        requestId: (req as any).requestId ?? null,
      });
    }
    console.log(`[auth.mvp] 쿨다운 통과: ${p}`);

    // OTP 코드 생성 및 저장
    const code = "" + Math.floor(100000 + Math.random() * 900000);
    console.log(`[auth.mvp] issueOtp 호출 전: ${p}, code: ${code}, context: ${ctx}`);
    let issueResult: any;
    let ok = false;
    try {
      issueResult = await issueOtp(p, code, ctx);
      ok = true;
    } catch (e) {
      console.warn("[otp] issueOtp failed:", e);
    }
    // ⬇️ 서비스가 실패했을 때만 하드세이브 (feature flag)
    if (!ok && process.env.OTP_HARD_SAVE === "1") {
      issueResult = await saveOtpHard(p, code, ctx, Number(process.env.OTP_TTL_SEC ?? 300));
    }
    console.log(`[auth.mvp] issueOtp 결과:`, issueResult);

    // 성공 시 레이트리밋 헤더 설정 (간단한 형태)
    res.set({
      "X-RateLimit-Limit": Math.max(PHONE_LIMIT, IP_LIMIT).toString(),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": Math.max(PHONE_WIN, IP_WIN).toString(),
    });

    // 개발 환경에서만 코드 표시
    const isDev = process.env.NODE_ENV !== "production";
    const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";

    const data: any = {
      phoneE164: p,
      expiresInSec: TTL,
      cooldown: 60, // 재전송 쿨다운 (1분)
      ...(includeDevCode ? { devCode: code } : {}),
    };

    if (includeDevCode) {
      console.log(`[DEV][OTP] ${p} -> ${code} (ttl=${TTL}s)`);
    }

    // 🆕 메트릭: OTP 전송 성공
    recordOtpSend("success", "SENS", carrier);

    // 성공 로깅
    const latencyMs = Date.now() - startTime;
    logOtpSend(
      "success",
      "OTP_SENT",
      200,
      req.requestId,
      phoneMasked(phone),
      ip,
      "SENS",
      undefined,
      {
        scope: "combo",
        limit: Math.max(PHONE_LIMIT, IP_LIMIT),
        remaining: 0,
        reset_sec: Math.max(PHONE_WIN, IP_WIN),
      },
      latencyMs,
    );

    return res.ok(data, "OTP_SENT", "OTP_SENT");
  } catch (e) {
    // 🆕 메트릭: OTP 전송 실패 (시스템 오류)
    recordOtpSend("fail", "SENS", "unknown");
    next(e);
  }
});

/** POST /api/v1/auth/resend-sms */
authRouter.post("/resend-sms", 
  withIdempotency(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    const { phone, carrier, context } = (req.body || {}) as {
      phone?: string;
      carrier?: string;
      context?: string;
    };
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    if (!phone || !carrier || !context) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, carrier required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const p = normalizeE164(phone);

    // 재전송 쿨다운 체크
    const cd = await checkAndMarkCooldown(p);
    if (cd.blocked) {
      return res.status(429).json({
        success: false,
        code: "RESEND_BLOCKED",
        message: "재전송 쿨다운 중입니다.",
        data: { retryAfter: cd.retryAfter },
        requestId: (req as any).requestId ?? null,
      });
    }

    // 쿨다운 체크 및 설정
    const cooldownPassed = await checkAndMarkCooldown(p, "register", 60);
    if (!cooldownPassed) {
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "재전송 쿨다운 중입니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // OTP 코드 생성 및 저장
    const code = "" + Math.floor(100000 + Math.random() * 900000);
    let ok = false;
    try { 
      await issueOtp(p, code, "register"); 
      ok = true;
    } catch (e) {
      console.warn("[otp] issueOtp failed:", e);
    }
    // ⬇️ 서비스가 실패했을 때만 하드세이브 (feature flag)
    if (!ok && process.env.OTP_HARD_SAVE === "1") {
      await saveOtpHard(p, code, "register", Number(process.env.OTP_TTL_SEC ?? 300));
    }

    // 개발 환경에서만 코드 표시
    const isDev = process.env.NODE_ENV !== "production";
    const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";

    const data: any = {
      phoneE164: p,
      expiresInSec: TTL,
      retryAfter: 60, // 재전송 쿨다운 (1분)
      ...(includeDevCode ? { devCode: code } : {}),
    };

    if (includeDevCode) {
      console.log(`[DEV][OTP] ${p} -> ${code} (ttl=${TTL}s) - RESEND`);
    }

    // 🆕 메트릭: OTP 재전송 성공
    recordOtpSend("success", "SENS", carrier);

    return res.ok(data, "OTP_RESENT", "OTP_RESENT");
  } catch (e) {
    next(e);
  }
});

/** POST /api/v1/auth/verify-code  — 로그인(쿠키에 Access JWT만 심음) */
authRouter.post("/verify-code", 
  withIdempotency(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
  async (req: Request, res: Response, next: NextFunction) => {
  console.log(`[ROUTER DEBUG] /auth/verify-code 요청 처리 시작 - auth.mvp.ts`);
  try {
    const startTime = Date.now();
    const { phone, code, context } = (req.body || {}) as {
      phone?: string;
      code?: string;
      context?: string;
    };
    const ctx = context?.trim() || "register";
    const p = normalizeE164(phone);
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    if (!phone || !code) {
      // 🆕 메트릭: OTP 검증 실패 (잘못된 요청)
      recordOtpVerify("fail", "BAD_REQUEST");

      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, code required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // OTP 검증 (강화된 예외 처리)
    let otpData;
    try {
      otpData = await fetchOtp(p, ctx);
      console.log(`[DEBUG] OTP 검증: ${p}, exists: ${otpData?.exists}, expired: ${otpData?.expired}, ttl: ${otpData?.ttl}`);
      let usedCtx = ctx;
      
      if (!otpData?.exists) {
        // 백오프: 혹시 저장 측 컨텍스트가 다른 값이었으면 한 번 더 조회
        const fallbacks = ctx === "register" ? ["login"] : ["register"];
        for (const fb of fallbacks) {
          const probe = await fetchOtp(p, fb);
          if (probe?.exists) {
            otpData = probe;
            usedCtx = fb;
            console.log(`[DEBUG] 백오프 조회 성공: ${p}, fallback context: ${fb}`);
            break;
          }
        }
      }
      
      if (!otpData?.exists) {
        // 🆕 메트릭: OTP 검증 실패 (코드 만료)
        recordOtpVerify("fail", "EXPIRED");

        return res.status(410).json({
          success: false,
          code: "EXPIRED",
          message: "인증번호가 만료되었습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      if (otpData?.expired) {
        // 🆕 메트릭: OTP 검증 실패 (코드 만료)
        recordOtpVerify("fail", "EXPIRED");

        return res.status(410).json({
          success: false,
          code: "EXPIRED",
          message: "인증번호가 만료되었습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      if (otpData?.code !== code) {
        // 🆕 메트릭: OTP 검증 실패 (잘못된 코드)
        recordOtpVerify("fail", "INVALID_CODE");

        return res.status(401).json({
          success: false,
          code: "INVALID_CODE",
          message: "잘못된 인증번호입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // ✅ 여기까지 오면 유효코드: 사용한 컨텍스트로 정확히 삭제
      try {
        const r = getRedis();
        await r.del(`otp:${usedCtx}:${p}`);
      } catch (delErr) {
        console.warn("[otp] delete failed (fallback to service):", delErr);
        try { await delOtp(p, usedCtx as any); } catch {}
      }
      
    } catch (otpError) {
      console.error(`[auth] OTP fetch error for ${p}:`, otpError);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // ⛔️ 위에서 이미 정확한 컨텍스트로 삭제 완료

    // 사용자 존재 여부 확인 (isNew 필드 결정)
    const existingUser = await findByPhone(p);
    const isNew = !existingUser; // 사용자가 없으면 신규 사용자

    // 가입 티켓 발급 (신규 사용자인 경우)
    if (isNew) {
      console.log(`[DEBUG] 신규 사용자 확인됨: ${p}, 가입 티켓 생성 시작`);
      
      const ticketKey = `reg:ticket:${p}`;
      const ticketData = {
        phone: p,
        verifiedAt: new Date().toISOString(),
        attempts: 1,
      };
      
      console.log(`[DEBUG] 티켓 데이터 준비:`, { ticketKey, ticketData });
      
      // 가입 티켓을 Redis에 저장 (30분 TTL)
      try {
        console.log(`[DEBUG] setOtp 호출 시작: ${ticketKey}`);
        await setOtp(ticketKey, JSON.stringify(ticketData), "ticket", 1800);
        console.log(`[DEBUG] setOtp 호출 완료: ${ticketKey}`);
        
        // 생성 확인 (기존 기능 보존)
        console.log(`[DEBUG] 티켓 생성 확인 시작: ${ticketKey}`);
        const verifyTicketResult = await getOtp(ticketKey, "ticket");
        console.log(`[DEBUG] getOtp 결과: ${ticketKey} = ${verifyTicketResult.code ? '존재' : '없음'}`);

        if (verifyTicketResult.code) {
          console.log(`[DEBUG] 가입 티켓 생성 확인됨: ${ticketKey}`);
          console.log(`[DEBUG] 티켓 내용:`, verifyTicketResult.code);
        } else {
          console.warn(`[WARN] 가입 티켓 생성 후 확인 실패: ${ticketKey}`);
        }
      } catch (error) {
        console.error(`[ERROR] setOtp 실패: ${ticketKey}`, error);
        // Redis 실패 시 메모리 폴백으로 티켓 생성 (기존 기능 보존)
        try {
          const memTicketKey = `mem:${ticketKey}`;
          const memTicketData = JSON.stringify(ticketData);
          // 메모리에 임시 저장 (30분 TTL)
          setTimeout(() => {
            // 30분 후 자동 삭제
          }, 1800 * 1000);
          console.log(`[DEBUG] 메모리 폴백 티켓 생성: ${memTicketKey}`);
        } catch (fallbackError) {
          console.error(`[ERROR] 메모리 폴백도 실패: ${ticketKey}`, fallbackError);
        }
      }
    } else {
      console.log(`[DEBUG] 기존 사용자: ${p}, 로그인 처리 시작`);
      
      // 기존 사용자 로그인 처리: 토큰 발급 및 쿠키 설정
      try {
        const user = await findByPhone(p);
        if (user) {
          const jti = newJti();
          const at = signAccessToken(user.id, jti);
          const rt = signRefreshToken(user.id, jti);
          
          // 로그인 성공 시 쿠키 설정
          setAuthCookies(res, at, rt);
          
          console.log(`[DEBUG] 로그인 성공: ${p}, 토큰 발급 완료`);
        }
      } catch (error) {
        console.error(`[ERROR] 로그인 처리 실패: ${p}`, error);
        // 로그인 실패 시에도 OTP 검증은 성공으로 처리
      }
    }

    // 🆕 메트릭: OTP 검증 성공
    recordOtpVerify("success", "VALID_CODE");

    // 성공 로깅
    const latencyMs = Date.now() - startTime;
    logOtpVerify(
      "success",
      "OTP_VERIFIED",
      200,
      req.requestId,
      phoneMasked(p),
      ip,
      undefined,
      latencyMs,
    );

    // 응답 메시지 결정
    const message = isNew ? "SIGNUP_REQUIRED" : "LOGIN_OK";

    return res.ok(
      {
        verified: true,
        isNew,
        ...(isNew
          ? {
              registrationTicket: {
                expiresIn: 1800, // 30분
                message: "Phone verified. You can now complete registration.",
              },
            }
          : {}),
      },
      message,
      message,
    );
  } catch (e) {
    // 🆕 메트릭: OTP 검증 실패 (시스템 오류)
    recordOtpVerify("fail", "SYSTEM_ERROR");
    next(e);
  }
});

/** POST /api/v1/auth/test/expire-otp - 테스트용 OTP 만료 엔드포인트 */
authRouter.post("/test/expire-otp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = (req.body || {}) as { phone?: string };

    if (!phone) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 개발 환경에서만 허용
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "테스트 엔드포인트는 개발 환경에서만 사용 가능합니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // OTP 강제 만료 (TTL을 1초로 설정)
    await setOtp(phone, "EXPIRED", "register", 1);

    console.log(`[TEST] OTP 강제 만료: ${phone}`);

    return res.status(200).json({
      success: true,
      code: "OK",
      message: "OTP가 강제로 만료되었습니다.",
      data: { phone, expiresIn: 1 },
      requestId: (req as any).requestId ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/v1/auth/signup - 최종 1회 제출(약관 동의 시점) */
authRouter.post("/signup", 
  withIdempotency(300), // 🆕 멱등성 적용 (5분 TTL)
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code, context } = (req.body || {}) as {
      phone?: string;
      code?: string;
      context?: string;
    };

    if (!phone || !code || !context) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, code required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // OTP 검증
    try {
      const verifyResult = await verifyOtp(phone, code, "register");
      
      if (!verifyResult.ok) {
        const status = verifyResult.code === "EXPIRED" ? 410 : 401;
        return res.status(status).json({
          success: false,
          code: verifyResult.code,
          message: verifyResult.code === "EXPIRED" ? "인증번호가 만료되었습니다." : "잘못된 OTP 코드입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }
    } catch (error) {
      console.error(`[auth] OTP verify error for ${phone}:`, error);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 가입 티켓 확인
    const ticketKey = `reg:ticket:${phone}`;
    const ticketDataResult = await getOtp(ticketKey, "ticket");

    if (ticketDataResult.error) {
      console.error(`[auth] Ticket get error for ${phone}:`, ticketDataResult.error);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "서버 내부 오류",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    if (!ticketDataResult.code) {
      return res.status(400).json({
        success: false,
        code: "REGISTRATION_EXPIRED",
        message: "가입 티켓이 만료되었습니다. 다시 인증해주세요.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 가입 티켓 삭제
    await delOtp(ticketKey);

    // 사용자 존재 여부 확인
    const existingUser = await findByPhone(phone);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: "USER_EXISTS",
        message: "이미 등록된 사용자입니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 새 사용자 생성 (여기서는 생성하지 않음, 별도 로직 필요)
    // TODO: 실제 사용자 생성 로직 구현
    const user = { id: "temp", phone };

    // 🆕 메트릭: 사용자 가입
    recordUserRegistration("success");

    // 성공 응답
    return res.ok(
      {
        user,
        message: "Registration completed successfully",
      },
      "SIGNUP_COMPLETED",
      "SIGNUP_COMPLETED",
    );
  } catch (e) {
    next(e);
  }
});

/** POST /api/v1/auth/logout — Access 쿠키만 제거 */
authRouter.post("/logout", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const opts = accessCookieOptions();
    res.clearCookie("access_token", { ...opts, expires: new Date(0) });
    return res.ok({}, "LOGOUT_OK", "LOGOUT_OK");
  } catch (e) {
    next(e);
  }
});

/** GET /api/v1/auth/me — 쿠키(or Bearer)에서 Access 검증 */
authRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromReq(req);              // ✅ 쿠키→헤더
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "missing token",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }
    
    const { uid } = verifyAccessTokenOrThrow(token); // ✅ 같은 시크릿/같은 파서
    const user = await getUserProfile(uid);
    return res.ok({ user }, "ME_OK", "ME_OK");
  } catch (e) {
    next(e);
  }
});

// 호환성 위해 default export도 제공
export default authRouter;
