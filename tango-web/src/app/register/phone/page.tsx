"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPhonePage() {
  const r = useRouter();
  const [localPhone, setLocalPhone] = useState("");

  // 전화번호 정규화 함수
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, ""); // 숫자만 추출
    if (digits.startsWith("0")) {
      return `+82${digits.substring(1)}`; // 0 제거하고 +82 추가
    }
    return `+82${digits}`; // +82 추가
  };

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!localPhone || localPhone.length < 10) return;
    
         // 정규화된 전화번호를 sessionStorage에 저장
     const normalizedPhone = normalizePhone(localPhone);
     window.sessionStorage.setItem("phone", normalizedPhone);
     
     // 🚨 E.164 변환 결과 상세 로깅
     console.log("[phone] E.164 normalization:", { 
       local: localPhone, 
       normalized: normalizedPhone,
       startsWith82: normalizedPhone.startsWith('+82'),
       length: normalizedPhone.length,
       isValid: normalizedPhone.length >= 13 && normalizedPhone.startsWith('+82')
     });
    
    r.push("/register/carrier");
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자와 하이픈만 허용, 최대 11자리
    const cleaned = value.replace(/[^\d-]/g, "").slice(0, 11);
    setLocalPhone(cleaned);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">휴대폰 번호 입력</h1>
      <form onSubmit={next} className="space-y-3">
        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <span className="text-gray-600 font-semibold mr-2">+82</span>
          <input 
            className="flex-1 outline-none border-none bg-transparent"
            type="tel"
            placeholder="10xxxxxxxx"
            value={localPhone}
            onChange={handlePhoneChange}
            maxLength={11}
            required
          />
        </div>
        <button 
          className="btn btn-primary w-full" 
          disabled={!localPhone || localPhone.length < 10}
        >
          다 음
        </button>
      </form>
      <p className="text-xs opacity-70">
        입력하신 번호는 공개되지 않습니다.
      </p>
      <div className="text-xs text-gray-500">
        <p>예시: 01012345678 → +821012345678</p>
        <p>현재 입력: {localPhone ? `+82${localPhone.replace(/^0/, "")}` : "전화번호를 입력하세요"}</p>
      </div>
    </div>
  );
}
