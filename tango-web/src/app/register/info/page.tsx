"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";

export default function RegisterInfoPage(){
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [gender, setGender] = useState<"M"|"F"|"" >("");
  const [terms, setTerms] = useState({ tos:false, privacy:false });
  const [msg, setMsg] = useState("");

  // 전화번호와 통신사 확인
  useEffect(() => {
    const phone = sessionStorage.getItem("phone");
    const carrier = sessionStorage.getItem("carrier");
    
    if (!phone || !carrier) {
      location.href = "/register/phone";
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

  // 최종 제출
  const onSubmit = async () => {
    if (!terms.tos || !terms.privacy) {
      setMsg("이용약관과 개인정보 처리방침에 동의해주세요.");
      return;
    }

    try {
      const r = await fetch(`${BASE}/api/v1/auth/register/submit`, {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          phone: sessionStorage.getItem("phone"),
          name, birth, gender,
          termsAccepted: [{key:"tos",version:"1.0.0"}, {key:"privacy",version:"1.0.0"}]
        })
      });
      const j = await r.json();
      if (j.success) {
        // OTP 발송을 위해 verify 페이지로 이동
        location.href="/register/verify";
      } else {
        setMsg(j.message || "가입에 실패했습니다.");
      }
    } catch (error) {
      setMsg("서버 오류가 발생했습니다.");
    }
  };

  // 각 단계별 유효성 검사
  const canGoNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return birth && gender;
    if (step === 3) return terms.tos && terms.privacy;
    return false;
  };

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">기본정보 입력</h1>
      
      {/* 진행 상태 표시 */}
      <div className="mb-6 flex items-center justify-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
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
              canGoNext() 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onSubmit}
            disabled={!canGoNext()}
          >
            다음 단계
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