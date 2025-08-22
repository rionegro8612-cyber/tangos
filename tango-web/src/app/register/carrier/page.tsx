"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterCarrierPage() {
  const r = useRouter();
  const [carrier, setCarrier] = useState("SKT");
  const [loading, setLoading] = useState(true);
  
  // SSR 회피: 브라우저에서만 sessionStorage 읽기
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(()=>{ 
    try {
      const p = window.sessionStorage.getItem("phone");
      setPhone(p);
      
      if (!p) {
        r.replace("/register/phone");
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [r]);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      r.replace("/register/phone");
      return;
    }
    window.sessionStorage.setItem("carrier", carrier);
    r.push("/register/info"); // 기본정보 입력 페이지로 이동
  }

  // 로딩 중이거나 필수 데이터가 없으면 로딩 표시
  if (loading || !phone) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <div className="text-center">
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">통신사 선택</h1>
      <p className="opacity-70">번호: {phone}</p>
      <form onSubmit={next} className="space-y-3">
        <select className="select select-bordered w-full" value={carrier} onChange={(e)=>setCarrier(e.target.value)}>
          <option>SKT</option><option>KT</option><option>LG U+</option>
        </select>
        <button className="btn btn-primary w-full">다 음</button>
      </form>
    </div>
  );
}
