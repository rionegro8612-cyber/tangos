"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@/src/lib/api";
import { useSignupDraft } from "@/src/lib/useSignupDraft";
import { useOtpTimer } from "@/src/lib/useOtpTimer";

export default function RegisterVerifyPage() {
  const r = useRouter();
  const { draft, updateDraft } = useSignupDraft();
  const [code, setCode] = useState(draft.code ?? "");
  const [msg, setMsg] = useState("");
  const { remain, label, reset } = useOtpTimer(300);

  useEffect(()=>{ 
    if (!draft.phone || !draft.carrier) r.replace("/register/phone"); 
  }, [draft.phone, draft.carrier, r]);

  async function verify() {
    setMsg("");
    try {
      await api<{ phoneVerified: boolean }>("/auth/register/verify-code", {
        method: "POST", body: JSON.stringify({ phone: draft.phone, code })
      });
      updateDraft({ code, phoneVerified: true });
      r.push("/register/info");
    } catch (err:any) {
      setMsg(err.message || "인증 실패");
    }
  }

  async function resend() {
    try {
      const res = await api<{ issued: boolean; ttlSec: number; devCode?: string }>("/auth/register/start", {
        method: "POST", body: JSON.stringify({ phone: draft.phone, carrier: draft.carrier })
      });
      updateDraft({ code: res.data.devCode });
      reset(300);
    } catch (e:any) { setMsg(e.message); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">인증번호 확인</h1>
      <p className="opacity-70">남은 시간 {label}</p>
      <div className="flex gap-2">
        <input className="input input-bordered grow" placeholder="123456" value={code}
          onChange={(e)=>setCode(e.target.value)} />
        <button className="btn btn-primary" onClick={verify} disabled={remain<=0}>확인</button>
      </div>
      <button className="btn btn-outline w-full" disabled={remain>0} onClick={resend}>재전송</button>
      {draft.code && (<p className="text-xs opacity-60">devCode: {draft.code}</p>)}
      {msg && <p className="text-red-500 text-sm">{msg}</p>}
    </div>
  );
}