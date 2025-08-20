"use client";
import { useSignupDraft } from "@/src/lib/useSignupDraft";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@/src/lib/api";


export default function RegisterInfoPage() {
  const r = useRouter();
  const { draft, updateDraft, clearDraft } = useSignupDraft();
  const [name, setName] = useState(draft.name ?? "");
  const [birth, setBirth] = useState(draft.birth ?? "");
  const [gender, setGender] = useState(draft.gender ?? "");
  const [tos, setTos] = useState(!!draft.terms?.tos);
  const [privacy, setPrivacy] = useState(!!draft.terms?.privacy);
  const [marketing, setMarketing] = useState(!!draft.terms?.marketing);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ 
    if (!draft.phone || !draft.carrier) r.replace("/register/phone"); 
  }, [draft.phone, draft.carrier, r]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!tos || !privacy) { setMsg("약관 동의가 필요합니다."); return; }
    setLoading(true);
    try {
      const res = await api<{ userId: number; autoLogin: boolean }>("/auth/register/submit", {
        method: "POST", body: JSON.stringify({
          phone: draft.phone, name, birth, gender: gender || undefined, carrier: draft.carrier,
          terms: { tos, privacy, marketing }
        })
      });
      updateDraft({ name, birth, gender: gender as any, terms: { tos, privacy, marketing } });
      // 자동 로그인 쿠키 세팅됨 → 닉네임으로 이동
      r.push("/onboarding/nickname");
    } catch (err:any) {
      const code = err.code;
      if (code === "KYC_AGE_RESTRICTED") setMsg("50세 이상만 가입 가능합니다.");
      else if (code === "KYC_MISMATCH") setMsg("본인 정보가 일치하지 않습니다.");
      else if (code === "KYC_TEMPORARY_FAILURE") setMsg("본인인증 지연 중입니다. 잠시 후 다시 시도해주세요.");
      else setMsg(err.message);
    } finally { setLoading(false); }
  }


return (
<div className="max-w-md mx-auto p-6 space-y-4">
<h1 className="text-2xl font-bold">기본 정보 입력</h1>
<form className="space-y-3" onSubmit={onSubmit}>
<input className="input input-bordered w-full" placeholder="이름" value={name} onChange={(e)=>setName(e.target.value)} required />
<input className="input input-bordered w-full" placeholder="생년월일(YYYYMMDD)" value={birth} onChange={(e)=>setBirth(e.target.value)} required />
<select className="select select-bordered w-full" value={gender} onChange={(e)=>setGender(e.target.value as "M" | "F" | "")}>
<option value="">성별 선택(옵션)</option>
<option value="M">남</option>
<option value="F">여</option>
</select>
<label className="flex items-center gap-2"><input type="checkbox" checked={tos} onChange={e=>setTos(e.target.checked)} /> 이용약관 동의(필수)</label>
<label className="flex items-center gap-2"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)} /> 개인정보 처리방침 동의(필수)</label>
<label className="flex items-center gap-2"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)} /> 마케팅 수신 동의(선택)</label>
<button className="btn btn-primary w-full" disabled={loading}>가입 완료</button>
</form>
{msg && <p className="text-red-500 text-sm">{msg}</p>}
</div>
);
}