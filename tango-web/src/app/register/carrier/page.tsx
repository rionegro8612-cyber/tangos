"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { useSignupDraft } from "@/src/lib/useSignupDraft";

export default function RegisterCarrierPage() {
  const r = useRouter();
  const { draft, updateDraft } = useSignupDraft();
  const [carrier, setCarrier] = useState(draft.carrier ?? "SKT");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ 
    if (!draft.phone) {
      r.replace("/register/phone");
      return;
    }
  }, [draft.phone, r]);

  async function issueOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.phone) {
      r.replace("/register/phone");
      return;
    }
    setMsg(""); setLoading(true);
    try {
      const res = await api<{ issued: boolean; ttlSec: number; devCode?: string }>("/auth/register/start", {
        method: "POST",
        body: JSON.stringify({ phone: draft.phone, carrier })
      });
      updateDraft({ carrier, code: res.data.devCode });
      r.push("/register/verify");
    } catch (err:any) {
      const code = err.code;
      if (code === "USER_EXISTS") setMsg("이미 가입된 번호입니다. 로그인으로 이동해주세요.");
      else setMsg(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">통신사 선택</h1>
      <p className="opacity-70">번호: {draft.phone}</p>
      <form onSubmit={issueOtp} className="space-y-3">
        <select className="select select-bordered w-full" value={carrier} onChange={(e)=>setCarrier(e.target.value)}>
          <option>SKT</option><option>KT</option><option>LG U+</option>
        </select>
        <button disabled={loading} className="btn btn-primary w-full">다 음</button>
      </form>
      {draft.code && <p className="text-xs opacity-60">devCode: {draft.code}</p>}
      {msg && <p className="text-red-500 text-sm">{msg}</p>}
    </div>
  );
}
