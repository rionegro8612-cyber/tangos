"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendSms, verifyCode } from "@/features/auth/api";
import { useCountdown } from "@/hooks/useCountdown";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { left, reset, isActive } = useCountdown(0);
  const router = useRouter();

  async function onSendSms() {
    setError(null);
    setLoading(true);
    try {
      const res = await sendSms({ phone });
      reset(res.expiresInSec ?? 180);
      setStep("code");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "인증번호 발송 실패";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    setError(null);
    setLoading(true);
    try {
      const res = await verifyCode({ phone, code });
      localStorage.setItem("accessToken", res.accessToken);
      setStep("done");
      router.push("/onboarding/nickname");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "인증 실패";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const canResend = !isActive;

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-2xl font-semibold mb-4">휴대폰 로그인</h1>

      {step === "phone" && (
        <section className="space-y-3">
          <label className="block text-sm">휴대폰 번호</label>
          <input
            className="w-full rounded-lg border p-3"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-50"
            onClick={onSendSms}
            disabled={loading || !phone}
          >
            {loading ? "전송 중..." : "인증번호 받기"}
          </button>
        </section>
      )}

      {step === "code" && (
        <section className="space-y-3">
          <div className="text-sm text-gray-600">입력한 번호: {phone}</div>
          <label className="block text-sm">인증번호</label>
          <input
            className="w-full rounded-lg border p-3 tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          <button
            className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-50"
            onClick={onVerify}
            disabled={loading || code.length < 4}
          >
            {loading ? "확인 중..." : "확인"}
          </button>

          <button
            className="w-full rounded-lg border py-3 disabled:opacity-50"
            onClick={onSendSms}
            disabled={!canResend || loading}
            title={isActive ? `재요청 ${left}s` : ""}
          >
            {isActive ? `재전송 대기 ${left}s` : "인증번호 재전송"}
          </button>
        </section>
      )}

      {step === "done" && (
        <section className="space-y-2">
          <div className="text-green-700 font-medium">로그인 완료!</div>
          <div className="text-sm text-gray-600">이제 온보딩으로 이동합니다.</div>
        </section>
      )}

      {error && <p className="text-red-600 mt-4">{error}</p>}
    </main>
  );
}