// src/app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendSms, verifyCode, me } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

// 🆕 새로운 API 함수 사용 옵션 (선택사항)
// import { api, StandardResponse } from "@/lib/api";
// 
// 사용 예시:
// const res = await api<{issued:boolean; ttlSec:number; devCode?:string}>("/auth/send-sms", {
//   method: "POST", body: JSON.stringify({ phone })
// });
// 
// const res = await api<{ userId:number; autoLogin:boolean }>("/auth/verify-login", {
//   method: "POST", body: JSON.stringify({ phone, code })
// });

function normalizeKrPhone(input: string): string {
  const d = (input || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("82")) return `+${d}`;
  if (d.startsWith("0")) return `+82${d.slice(1)}`;
  return `+${d}`;
}

function pickDevCode(res: any): string | undefined {
  const d = res?.data ?? res;
  return (
    d?.devCode ?? d?.dev_code ?? d?.code ?? d?.otp ?? d?.otpCode ?? d?.otp_code ??
    d?.smsCode ?? d?.DEBUG_OTP ?? d?.DEBUG_CODE ?? d?.debug?.otp ?? d?.debug?.code ??
    d?.meta?.otp ?? d?.meta?.devCode ?? undefined
  );
}

function pickPhoneE164(res: any, fallbackRaw: string): string {
  const d = res?.data ?? res;
  return d?.phoneE164 ?? d?.phone_e164_norm ?? d?.phone ?? normalizeKrPhone(fallbackRaw);
}

function pickUser(j: any) {
  return j?.data?.user ?? j?.user ?? (typeof j?.data === "object" ? j.data : null) ?? null;
}

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:4100"
).replace(/\/+$/, "");

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  const devMode = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (user) router.replace("/profile");
  }, [router, user]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function onSendSms() {
    const raw = phone.trim();
    if (!raw) return alert("전화번호를 입력하세요.");
    setSending(true);
    try {
      const res: any = await sendSms(raw, { dev: devMode });     // dev 옵션 객체로 전달
      setE164(pickPhoneE164(res, raw));
      const dc = pickDevCode(res);
      setDevCode(dc ? String(dc) : undefined);
      setStep(2);
      setCooldown(60);
    } catch (e: any) {
      alert(e?.message || "인증번호 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function onVerify() {
    const raw = phone.trim();
    const c = code.trim();
    if (!raw || !c) return alert("전화번호와 인증번호를 입력하세요.");
    setVerifying(true);
    try {
      // ✅ 쿠키를 받으려면 verifyCode 내부 fetch도 credentials:'include' 여야 합니다.
      // 현재: /api/v1/auth/verify-code (백엔드 경로와 일치)
      // 참고: 새로운 api 함수 사용 시 /auth/verify-login으로 변경 가능
      const verifyResult = await verifyCode(raw, c);
      
      // ✅ 백엔드 응답에서 userId 확인
      if (verifyResult?.data?.userId) {
        // 로그인 성공 후 사용자 정보 가져오기
        let u: any = null;
        try {
          const r1: any = await me();          // /api/v1/auth/me
          u = r1?.data ?? null;
        } catch { /* ignore */ }

        // ✅ 유저가 확실히 생겼을 때만 /profile로 이동 (튕김 방지)
        if (u) {
          setUser(u);
          router.replace("/profile");
        } else {
          alert("로그인 세션이 확인되지 않았습니다. 쿠키 설정을 확인해주세요.");
        }
      } else {
        alert("로그인에 실패했습니다. 인증번호를 확인해주세요.");
      }
    } catch (e: any) {
      alert(e?.message || "인증에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">로그인</h1>

      {step === 1 && (
        <section className="space-y-3 rounded-xl border p-4">
          <label className="block text-sm text-gray-600">전화번호</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="01012345678 혹은 +821012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            onClick={onSendSms}
            disabled={sending || cooldown > 0}
          >
            {sending ? "전송 중…" : cooldown > 0 ? `재전송 ${cooldown}s` : "인증번호 받기"}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3 rounded-xl border p-4">
          <div className="text-sm text-gray-600">
            전송 대상: <b>{e164 || normalizeKrPhone(phone)}</b>
          </div>

          {devMode && devCode && (
            <p className="text-sm text-gray-700">
              인증번호: <b className="tracking-widest">{devCode}</b>{" "}
              <span className="text-gray-500">(개발 모드)</span>
            </p>
          )}

          <label className="block text-sm text-gray-600">인증번호</label>
          <input
            className="w-full rounded border px-3 py-2 tracking-widest"
            placeholder="6자리"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
          />

          <div className="flex gap-2">
            <button
              className="flex-1 rounded bg-black px-3 py-2 text-white disabled:opacity-60"
              onClick={onVerify}
              disabled={verifying}
            >
              {verifying ? "확인 중…" : "로그인"}
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={() => setStep(1)}
              disabled={verifying}
            >
              번호 변경
            </button>
          </div>

          <button
            className="underline text-sm disabled:opacity-60"
            onClick={onSendSms}
            disabled={sending || cooldown > 0}
            title="인증번호 재전송"
          >
            {cooldown > 0 ? `재전송 ${cooldown}s` : "인증번호 재전송"}
          </button>
        </section>
      )}

      {/* 회원가입 시작 버튼 */}
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-3">아직 계정이 없으신가요?</p>
        <button
          className="w-full rounded border-2 border-gray-300 px-4 py-2 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          onClick={() => router.push("/register/phone")}
        >
          회원가입 시작하기
        </button>
      </div>
    </main>
  );
}
