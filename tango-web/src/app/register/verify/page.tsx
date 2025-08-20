"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterVerifyPage() {
  const r = useRouter();
  
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(5 * 60); // 05:00
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phone = sessionStorage.getItem("phone");
  const carrier = sessionStorage.getItem("carrier");

  useEffect(() => {
    if (!phone || !carrier) {
      r.replace("/register/phone");
      return;
    }
  }, [phone, carrier, r]);

  // 타이머 설정
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 타이머 포맷팅
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const expired = left === 0;

  // 인증번호 검증
  const onVerify = async () => {
    if (expired || !code.trim()) return;
    
    setBusy(true);
    setMsg("");
    
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";
      const response = await fetch(`${base}/api/v1/auth/register/verify-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code })
      });
      
      const data = await response.json();
      if (data.success) {
        sessionStorage.setItem("phoneVerified", "true");
        r.push("/register/info");
      } else {
        setMsg(data.message || "인증에 실패했습니다.");
      }
    } catch (err: any) {
      setMsg("인증에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 재전송
  const onResend = async () => {
    setBusy(true);
    setMsg("");
    
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";
      const response = await fetch(`${base}/api/v1/auth/register/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, carrier })
      });
      
      const data = await response.json();
      if (data.success) {
        setMsg("새 인증번호를 전송했습니다.");
        setCode("");
        setLeft(5 * 60); // 타이머 리셋
        if (data.data?.devCode) {
          sessionStorage.setItem("devCode", data.data.devCode);
        }
      } else {
        setMsg(data.message || "재전송에 실패했습니다.");
      }
    } catch (err: any) {
      setMsg("재전송에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-2">인증번호 입력</h1>
      <p className="text-gray-600 mb-4">남은 시간 {mm}:{ss}</p>

      <input
        className="w-full border rounded p-3 mb-3"
        placeholder="6자리"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        disabled={expired || busy}
      />

      <button
        className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-40"
        disabled={expired || busy || code.length !== 6}
        onClick={onVerify}
      >
        {busy ? "인증 중..." : "인증하기"}
      </button>

      <button
        className="mt-3 w-full rounded-xl p-3 border"
        disabled={!expired || busy}
        onClick={onResend}
      >
        {busy ? "전송 중..." : "재전송"}
      </button>

      {sessionStorage.getItem("devCode") && (
        <p className="mt-3 text-xs opacity-60">devCode: {sessionStorage.getItem("devCode")}</p>
      )}
      
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
    </main>
  );
}