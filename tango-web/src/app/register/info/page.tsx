"use client";
import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";

export default function RegisterInfoPage(){
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [gender, setGender] = useState<"M"|"F"|"" >("");
  const [terms, setTerms] = useState({ tos:false, privacy:false });
  const [msg, setMsg] = useState("");

  // 전화번호 인증 확인
  useEffect(() => {
    const phone = sessionStorage.getItem("phone");
    const phoneVerified = sessionStorage.getItem("phoneVerified");
    
    if (!phone || !phoneVerified) {
      location.href = "/register/phone";
    }
  }, []);

  const canSubmit = name && /^\d{4}-\d{2}-\d{2}$/.test(birth) && (gender==="M"||gender==="F") && terms.tos && terms.privacy;

  const onSubmit = async () => {
    const r = await fetch(`${BASE}/api/v1/auth/register/submit`, {
      method:"POST", credentials:"include",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        phone: sessionStorage.getItem("phone"), // 이전 단계에 저장했다고 가정
        name, birth, gender,
        termsAccepted: [{key:"tos",version:"1.0.0"}, {key:"privacy",version:"1.0.0"}]
      })
    });
    const j = await r.json();
    if (j.success) location.href="/onboarding/nickname";
    else setMsg(j.message || "가입에 실패했습니다.");
  };

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">기본정보 입력</h1>
      <input className="w-full border rounded p-3 mb-2" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} />
      <input className="w-full border rounded p-3 mb-2" placeholder="생년월일 (YYYY-MM-DD)" value={birth} onChange={e=>setBirth(e.target.value)} />
      <div className="flex gap-3 mb-2">
        <button className={`border rounded px-4 py-2 ${gender==="M"?"bg-black text-white":""}`} onClick={()=>setGender("M")}>남</button>
        <button className={`border rounded px-4 py-2 ${gender==="F"?"bg-black text-white":""}`} onClick={()=>setGender("F")}>여</button>
      </div>
      <label className="block mb-1"><input type="checkbox" checked={terms.tos} onChange={e=>setTerms(s=>({...s,tos:e.target.checked}))} /> 이용약관 동의</label>
      <label className="block mb-4"><input type="checkbox" checked={terms.privacy} onChange={e=>setTerms(s=>({...s,privacy:e.target.checked}))} /> 개인정보 처리방침 동의</label>

      <button className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-40" disabled={!canSubmit} onClick={onSubmit}>제출</button>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
    </main>
  );
}