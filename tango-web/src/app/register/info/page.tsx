"use client";
import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // 예: http://localhost:4100

export default function RegisterInfoPage(){
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [gender, setGender] = useState<"M"|"F"|"" >("");
  const [terms, setTerms] = useState({ tos:false, privacy:false });
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // SSR 회피: 브라우저에서만 sessionStorage 읽기
  const [phone, setPhone] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);

  // 전화번호와 통신사 확인
  useEffect(() => {
    try {
      const p = window.sessionStorage.getItem("phone");
      const c = window.sessionStorage.getItem("carrier");
      setPhone(p);
      setCarrier(c);
      
      if (!p || !c) {
        window.location.href = "/register/phone";
        return;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 다음 단계로 이동
  const nextStep = () => {
    if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2 && birth && gender) {
      setStep(3);
    }
  };

  // 이전 단계로 이동
  const prevStep = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  // 인증번호 발송 및 verify 페이지로 이동
  const onSendSms = async () => {
    console.log("[onSendSms] start", { phone, carrier, API_BASE, terms });

    if (!terms.tos || !terms.privacy || !phone || !carrier) {
      setMsg("이용약관과 개인정보 처리방침에 동의해주세요.");
      return;
    }

    if (!API_BASE) {
      alert("환경변수 NEXT_PUBLIC_API_BASE가 비어 있습니다.");
      return;
    }

    setSending(true);
    setMsg("");

    try {
      // 인증번호 발송
             const response = await fetch(`${API_BASE}/auth/send-sms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          carrier,
          context: "signup"
        })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `HTTP ${response.status} ${response.statusText} :: ${text}`;
        console.error("[send-sms failed]", errorMsg);
        setMsg(errorMsg);
        return;
      }

      const data = await response.json();
      console.log("[send-sms OK]", data);
      
      if (data.success) {
        // 모든 정보를 sessionStorage에 저장
        window.sessionStorage.setItem("name", name);
        window.sessionStorage.setItem("birth", birth);
        window.sessionStorage.setItem("gender", gender);
        window.sessionStorage.setItem("terms", JSON.stringify(terms));
        
        // verify 페이지로 이동
        window.location.href = "/register/verify";
      } else {
        setMsg(data.message || "인증번호 전송에 실패했습니다.");
      }
    } catch (e: any) {
      console.error("[send-sms exception]", e?.message || e);
      setMsg("서버 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  // 각 단계별 유효성 검사
  const canGoNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return birth && gender;
    if (step === 3) return terms.tos && terms.privacy;
    return false;
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

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">기본정보 입력</h1>
      
      {/* 진행 상태 표시 */}
      <div className="mb-6 flex items-center justify-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
      </div>

      {/* 디버그 정보 표시 */}
      <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
        <p>전화번호: {phone}</p>
        <p>통신사: {carrier}</p>
        <p>API_BASE: {API_BASE}</p>
      </div>

      {/* 단계 1: 이름 입력 */}
      {step >= 1 && (
        <div className={`mb-4 transition-all duration-300 ${step === 1 ? 'opacity-100' : 'opacity-60'}`}>
          <label className="block text-sm font-medium mb-2">이름</label>
          <input 
            className="w-full border rounded p-3" 
            placeholder="이름을 입력하세요" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            disabled={step !== 1}
          />
        </div>
      )}

      {/* 단계 2: 생년월일/성별 입력 */}
      {step >= 2 && (
        <div className={`mb-4 transition-all duration-300 ${step === 2 ? 'opacity-100' : 'opacity-60'}`}>
          <label className="block text-sm font-medium mb-2">생년월일</label>
          <input 
            className="w-full border rounded p-3 mb-3" 
            type="date"
            placeholder="생년월일 (YYYY-MM-DD)" 
            value={birth} 
            onChange={e=>setBirth(e.target.value)}
            disabled={step !== 2}
          />
          
          <label className="block text-sm font-medium mb-2">성별</label>
          <div className="flex gap-3">
            <button 
              className={`border rounded px-4 py-2 transition-colors ${
                gender==="M" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300"
              }`} 
              onClick={()=>setGender("M")}
              disabled={step !== 2}
            >
              남성
            </button>
            <button 
              className={`border rounded px-4 py-2 transition-colors ${
                gender==="F" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300"
              }`} 
              onClick={()=>setGender("F")}
              disabled={step !== 2}
            >
              여성
            </button>
          </div>
        </div>
      )}

      {/* 단계 3: 약관 동의 */}
      {step >= 3 && (
        <div className={`mb-4 transition-all duration-300 ${step === 3 ? 'opacity-100' : 'opacity-60'}`}>
          <label className="block text-sm font-medium mb-2">약관 동의</label>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={terms.tos} 
                onChange={e=>setTerms(s=>({...s,tos:e.target.checked}))}
                disabled={step !== 3}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">이용약관에 동의합니다</span>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={terms.privacy} 
                onChange={e=>setTerms(s=>({...s,privacy:e.target.checked}))}
                disabled={step !== 3}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">개인정보 처리방침에 동의합니다</span>
            </label>
          </div>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className="flex gap-3 mt-6">
        {/* 이전 버튼 */}
        {step > 1 && (
          <button 
            className="flex-1 rounded-xl p-3 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={prevStep}
          >
            이전
          </button>
        )}
        
        {/* 다음/제출 버튼 */}
        {step < 3 ? (
          <button 
            className={`flex-1 rounded-xl p-3 transition-colors ${
              canGoNext() 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={nextStep}
            disabled={!canGoNext()}
          >
            다음
          </button>
        ) : (
          <button 
            className={`flex-1 rounded-xl p-3 transition-colors ${
              canGoNext() && !sending
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onSendSms}
            disabled={!canGoNext() || sending}
          >
            {sending ? "인증번호 전송 중..." : "다음"}
          </button>
        )}
      </div>

      {/* 에러 메시지 */}
      {msg && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{msg}</p>
        </div>
      )}

      {/* 현재 단계 안내 */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">
          {step === 1 && "이름을 입력해주세요"}
          {step === 2 && "생년월일과 성별을 선택해주세요"}
          {step === 3 && "약관에 동의해주세요"}
        </p>
      </div>
    </main>
  );
}