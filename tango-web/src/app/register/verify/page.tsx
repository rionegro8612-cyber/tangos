"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

// 전화번호는 이미 +82 형식으로 저장되어 있음

export default function RegisterVerifyPage() {
  const router = useRouter();
  
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(5 * 60); // 05:00
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 타이머 타입은 브라우저 기준 안전하게
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // SSR 회피용 상태
  const [phone, setPhone] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);

  // 1) 브라우저에서만 sessionStorage 읽기
  useEffect(() => {
    try {
      const p = window.sessionStorage.getItem("phone");
      const c = window.sessionStorage.getItem("carrier");
      setPhone(p);
      setCarrier(c);

      // 필수 값 없으면 이전 단계로
      if (!p) {
        router.replace("/register/phone");
        return;
      }
      if (!c) {
        router.replace("/register/carrier");
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 2) OTP 전송 함수 (상태/에러 로깅 강화)
  const sendOtp = useCallback(async () => {
    console.log("[sendOtp] start", { phone, carrier, API_BASE });

    if (!phone || !carrier) {
      console.warn("[sendOtp] missing phone/carrier → skip");
      return;
    }

    setBusy(true);
    setMsg("");

         try {
       // 전화번호는 이미 +82 형식으로 저장되어 있음
       // 개발 환경에서는 dev 파라미터 추가하여 devCode 표시
       const isDev = process.env.NODE_ENV !== "production";
       const url = `${API_BASE}/auth/send-sms${isDev ? "?dev=1" : ""}`;
       console.log(`[sendOtp] 요청 URL: ${url}, isDev: ${isDev}`);
       
       const r = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ phone, carrier, context: "register" }),
         credentials: "include",
       });

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        const msg = `HTTP ${r.status} ${r.statusText} :: ${text}`;
        console.error("[send-sms failed]", msg);
        setMsg(msg);
        return;
      }

      const data = await r.json();
      console.log("[send-sms OK]", data);
      
      if (data.success) {
        setOtpSent(true);
        setLeft(5 * 60); // 타이머 시작
        if (data.data?.devCode) {
          window.sessionStorage.setItem("devCode", data.data.devCode);
        }
        setMsg("인증번호를 전송했습니다.");
      } else {
        setMsg(data.message || "OTP 발송에 실패했습니다.");
      }

      // 재전송 타이머 예시
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.log("[sendOtp] resend enabled");
      }, 60_000);
    } catch (e: any) {
      console.error("[send-sms exception]", e?.message || e);
      setMsg(e?.message || "인증번호 전송 중 오류가 발생했습니다.");
    } finally { 
      setBusy(false); 
    }
  }, [phone, carrier]);

  // 3) 자동 발송(원하면 유지 / 아니라면 주석)
  useEffect(() => {
    if (!loading && phone && carrier && !otpSent) {
      console.log("[auto sendOtp]", { loading, phone, carrier, otpSent });
      void sendOtp();
    }
  }, [loading, phone, carrier, otpSent, sendOtp]);

  // 타이머 설정
  useEffect(() => {
    if (!otpSent) return;
    
    timerRef.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpSent]);

  // 타이머 포맷팅
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const expired = left === 0;

  // 인증번호 검증 및 회원가입 완료
  const onVerify = async () => {
    if (expired || !code.trim() || !phone || !carrier) return;
    
    setBusy(true);
    setMsg("");
    
    try {
      // sessionStorage에서 모든 정보 가져오기
      const name = window.sessionStorage.getItem("name");
      const birth = window.sessionStorage.getItem("birth");
      const gender = window.sessionStorage.getItem("gender");
      const termsStr = window.sessionStorage.getItem("terms");
      
      if (!name || !birth || !gender || !termsStr) {
        setMsg("회원가입 정보가 누락되었습니다. 처음부터 다시 진행해주세요.");
        return;
      }
      
      const terms = JSON.parse(termsStr);
      
                   // 1단계: OTP 코드 검증 (전화번호는 이미 +82 형식)
             const verifyBody = {
        phone,
        code,
        context: "register"
      };
      console.log("[verify-code request]", verifyBody);
      
      const response = await fetch(`${API_BASE}/auth/verify-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody)
      });
      
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `HTTP ${response.status} ${response.statusText} :: ${text}`;
        console.error("[verify-signup failed]", errorMsg);
        setMsg(errorMsg);
        return;
      }

             const data = await response.json();
       console.log("[verify-code response]", { status: response.status, data });
       
       if (data.success) {
         console.log("[verify-code success]", data);
         
         // 🚨 기존 회원 vs 신규 회원 분기 처리
         // 기존 회원인 경우: 로그인 완료 후 홈으로 이동
         if (data.code === 'LOGIN_OK' || data.message === 'LOGIN_OK' || !data.data?.isNew) {
           console.log("[verify-code] 기존 회원 로그인 완료:", data);
           setMsg("로그인되었습니다.");
           
           // 기존 회원: 토큰이 있다면 저장하고 홈으로 이동
           if (data.data?.accessToken) {
             window.sessionStorage.setItem("accessToken", data.data.accessToken);
           }
           if (data.data?.refreshToken) {
             window.sessionStorage.setItem("refreshToken", data.data.refreshToken);
           }
           
           // 잠시 후 홈으로 이동
           setTimeout(() => {
             router.replace("/");
           }, 2000);
           return;
         }
         
         // 🆕 신규 회원인 경우: OTP 검증만 완료하고 닉네임 설정 페이지로 이동
         console.log("[verify-code] 신규 회원 OTP 검증 완료, 닉네임 설정으로 이동");
         
         // 전화번호 인증 완료 표시를 sessionStorage에 저장
         window.sessionStorage.setItem("phoneVerified", "true");
         
         // 회원가입 정보도 sessionStorage에 저장 (닉네임/지역 설정 후 사용)
         window.sessionStorage.setItem("name", name);
         window.sessionStorage.setItem("birth", birth);
         window.sessionStorage.setItem("gender", gender);
         window.sessionStorage.setItem("terms", JSON.stringify(terms));
         
         // 닉네임 설정 페이지로 이동
         router.push("/onboarding/nickname");
      } else {
        setMsg(data.message || "인증번호가 올바르지 않습니다.");
      }
    } catch {
      setMsg("인증에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 재전송
  const onResend = async () => {
    if (busy) return;
    await sendOtp();
  };

  // 로딩 중이거나 필수 데이터가 없으면 로딩 표시
  if (loading || !phone || !carrier) {
    return (
      <main className="mx-auto max-w-[430px] p-6">
        <div className="text-center">
          <p>불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (!otpSent) {
    return (
      <main className="mx-auto max-w-[430px] p-6">
        <h1 className="text-xl font-bold mb-4">인증번호 발송</h1>
        <p className="text-gray-600 mb-4">휴대폰으로 인증번호를 전송합니다.</p>
        
        <p className="mb-2 text-sm text-gray-600">
          대상 번호: {phone ?? "-"} / 통신사: {carrier ?? "-"}
        </p>
        
        <button 
          className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-40" 
          disabled={busy} 
          onClick={sendOtp}
        >
          {busy ? "전송 중..." : "인증번호 전송"}
        </button>
        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-2">인증번호 입력</h1>
      <p className="text-gray-600 mb-4">남은 시간 {mm}:{ss}</p>

      <p className="mb-2 text-sm text-gray-600">
        대상 번호: {phone ?? "-"} / 통신사: {carrier ?? "-"}
      </p>

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
        disabled={busy}
        onClick={onResend}
      >
        {busy ? "전송 중..." : "재전송"}
      </button>

      {window.sessionStorage.getItem("devCode") && (
        <p className="mt-3 text-xs opacity-60">devCode: {window.sessionStorage.getItem("devCode")}</p>
      )}
      
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
    </main>
  );
}