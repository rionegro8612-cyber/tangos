"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100"; // 호스트만

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
    if (!API_BASE) {
      alert("환경변수 NEXT_PUBLIC_API_BASE가 비어 있습니다.");
      return;
    }

    setBusy(true);
    setMsg("");

         try {
       // 전화번호는 이미 +82 형식으로 저장되어 있음
       const r = await fetch(`${API_BASE}/auth/send-sms`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ phone, carrier, context: "signup" }),
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
         purpose: "signup"
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
          // 현재 응답에서 code가 "LOGIN_OK"인 경우 기존 회원으로 처리
          if (data.code === 'LOGIN_OK' || data.message === 'LOGIN_OK') {
            console.log("[verify-code] 기존 회원 로그인 완료:", data);
            setMsg("축하합니다! 회원가입이 완료되었습니다.");
            
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
         
         console.log("[verify-code] 신규 회원 또는 검증 완료, 회원가입 진행");
         
         // 2단계: 회원가입 정보 전송 (신규 회원만)
         try {
                                // 🚨 가입 요청 직전 전화번호 E.164 통일 확인
           console.log("[REGISTER payload phone]", {
             raw: phone,
             type: typeof phone,
             startsWith82: phone?.startsWith('+82'),
             length: phone?.length
           });
           
           const signupBody = {
             phone, // 이미 +82 형식으로 저장되어 있음
             name,
             birth: birth, // YYYY-MM-DD 형식
             gender,
             termsAccepted: [
               { key: "tos", version: "1.0" },
               { key: "privacy", version: "1.0" },
               ...(terms.marketing ? [{ key: "marketing", version: "1.0" }] : [])
             ]
           };
           console.log("[signup request]", signupBody);
          
                     const signupResponse = await fetch(`${API_BASE}/auth/register/submit`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signupBody)
          });
          
          if (!signupResponse.ok) {
            const text = await signupResponse.text().catch(() => "");
            const errorMsg = `회원가입 실패: HTTP ${signupResponse.status} ${signupResponse.statusText} :: ${text}`;
            console.error("[signup failed]", errorMsg);
            setMsg(errorMsg);
            return;
          }
          
          const signupData = await signupResponse.json();
          console.log("[signup response]", signupData);
          
          if (signupData.success) {
            // 회원가입 성공 - 세션 정보 저장
            if (signupData.data?.accessToken) {
              window.sessionStorage.setItem("accessToken", signupData.data.accessToken);
            }
            if (signupData.data?.refreshToken) {
              window.sessionStorage.setItem("refreshToken", signupData.data.refreshToken);
            }
            
            // 회원가입 완료 후 온보딩으로 이동
            router.push("/onboarding");
          } else {
            setMsg(signupData.message || "회원가입에 실패했습니다.");
          }
        } catch (error) {
          console.error("[signup exception]", error);
          setMsg("회원가입 중 오류가 발생했습니다.");
        }
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