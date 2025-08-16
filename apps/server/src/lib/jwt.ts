import jwt from "jsonwebtoken";

// 만료 설정(분/일)
const ACCESS_MIN  = Number(process.env.JWT_ACCESS_EXPIRES_MIN  ?? 15);
const REFRESH_DAY = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 14);

// PEM에 \n 이스케이프가 들어온 경우도 허용
function fmtPem(s: string) {
  const v = (s ?? "").trim();
  return v.includes("\\n") ? v.replace(/\\n/g, "\n") : v;
}

type Cfg =
  | { mode: "RS256"; priv: string; pub: string }
  | { mode: "HS256"; secret: string };

function resolveCfg(): Cfg {
  const priv = fmtPem(process.env.JWT_PRIVATE_KEY || "");
  const pub  = fmtPem(process.env.JWT_PUBLIC_KEY  || "");
  if (priv && pub) {
    console.log("[jwt] using RS256 (private/public provided)");
    return { mode: "RS256", priv, pub };
  }

  const secret = (process.env.JWT_SECRET || "").trim();
  if (secret) {
    console.log("[jwt] using HS256 (secret provided)");
    return { mode: "HS256", secret };
  }

  // 완전 무설정인 경우: 개발 편의 fallback (원하면 여기서 throw로 바꾸세요)
  const dev = "dev-secret-change-me";
  console.warn("[jwt] no key material found — falling back to HS256 with a dev secret");
  return { mode: "HS256", secret: dev };
}

const cfg = resolveCfg();

export function currentJwtMode() { return cfg.mode; }

export function signAccess(payload: object) {
  const opts: jwt.SignOptions = { algorithm: cfg.mode, expiresIn: `${ACCESS_MIN}m`, issuer: "tango" };
  return cfg.mode === "RS256"
    ? jwt.sign(payload, cfg.priv, opts)
    : jwt.sign(payload, cfg.secret, opts);
}

export function signRefresh(payload: object) {
  const opts: jwt.SignOptions = { algorithm: cfg.mode, expiresIn: `${REFRESH_DAY}d`, issuer: "tango" };
  return cfg.mode === "RS256"
    ? jwt.sign(payload, cfg.priv, opts)
    : jwt.sign(payload, cfg.secret, opts);
}

/** 토큰 검증: 토큰 header.alg를 우선 따르고, 실패하면 양쪽 키로 모두 시도 */
export function verifyToken(token: string): any {
  // 1) header.alg 힌트 사용
  try {
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as { alg?: string };
    const alg = (header?.alg || cfg.mode) as "HS256" | "RS256";
    if (alg === "HS256" && "secret" in cfg) {
      return jwt.verify(token, cfg.secret, { algorithms: ["HS256"], issuer: "tango" });
    }
    if (alg === "RS256" && "pub" in cfg) {
      return jwt.verify(token, cfg.pub, { algorithms: ["RS256"], issuer: "tango" });
    }
  } catch {
    // fall through
  }

  // 2) 힌트가 없거나 실패 시 양쪽 다 시도
  if ("secret" in cfg) {
    try { return jwt.verify(token, cfg.secret, { algorithms: ["HS256"], issuer: "tango" }); } catch {}
  }
  if ("pub" in cfg) {
    try { return jwt.verify(token, cfg.pub, { algorithms: ["RS256"], issuer: "tango" }); } catch {}
  }

  throw new Error("JWT key material missing");
}
