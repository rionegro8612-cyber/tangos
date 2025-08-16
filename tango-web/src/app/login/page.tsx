// src/app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendSms, verifyCode, me } from "@/src/lib/api";
import { useAuthStore } from "@/src/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [phone, setPhone] = useState("");
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
    if (!phone.trim()) return alert("전화번호를 입력하세요");
    setSending(true);
    try {
      // ✅ 두 번째 인자는 boolean
      const r = await sendSms(phone.trim(), devMode);
      setStep(2);
      setCooldown(60); // 서버 기본 쿨다운(60s)에 맞춰 UX 제공
      setDevCode(r.data.devCode);
    } catch (e: any) {
      alert(e.message || "발송 실패");
    } finally {
      setSending(false);
    }
  }

  async function onVerify() {
    if (!phone.trim() || !code.trim()) return alert("번호/코드를 입력하세요");
    setVerifying(true);
    try {
      await verifyCode(phone.trim(), code.trim());
      // 로그인 직후 사용자 조회 → 스토어에 반영
      const r = await me();
      setUser(r.data.user);
      router.replace("/profile");
    } catch (e: any) {
      alert(e.message || "인증 실패");
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
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            onClick={onSendSms}
            disabled={sending || cooldown > 0}
          >
            {sending ? "발송 중…" : cooldown > 0 ? `재발송 ${cooldown}s` : "인증 코드 받기"}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3 rounded-xl border p-4">
          <div className="text-sm text-gray-600">인증 코드 (문자/앱)</div>
          <input
            className="w-full rounded border px-3 py-2 tracking-widest"
            placeholder="6자리"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {devCode && (
            <p className="text-xs text-gray-500">
              devCode: <b>{devCode}</b> (개발 모드)
            </p>
          )}
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
            onClick={onSendSms}            // 재발송도 같은 핸들러
            disabled={sending || cooldown > 0}
            title="재발송"
          >
            {cooldown > 0 ? `재발송 ${cooldown}s` : "코드 재발송"}
          </button>
        </section>
      )}
    </main>
  );
}

