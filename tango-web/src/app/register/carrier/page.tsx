"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterCarrierPage() {
  const r = useRouter();
  const [carrier, setCarrier] = useState("SKT");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const phone = sessionStorage.getItem("phone");

  useEffect(()=>{ 
    if (!phone) {
      r.replace("/register/phone");
      return;
    }
  }, [phone, r]);

  async function issueOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      r.replace("/register/phone");
      return;
    }
    setMsg(""); setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";
      const res = await fetch(`${base}/api/v1/auth/register/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, carrier })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("carrier", carrier);
        if (data.data?.devCode) {
          sessionStorage.setItem("devCode", data.data.devCode);
        }
        r.push("/register/verify");
      } else {
        setMsg(data.message || "OTP 발송에 실패했습니다.");
      }
    } catch (err:any) {
      setMsg("OTP 발송 중 오류가 발생했습니다.");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">통신사 선택</h1>
      <p className="opacity-70">번호: {phone}</p>
      <form onSubmit={issueOtp} className="space-y-3">
        <select className="select select-bordered w-full" value={carrier} onChange={(e)=>setCarrier(e.target.value)}>
          <option>SKT</option><option>KT</option><option>LG U+</option>
        </select>
        <button disabled={loading} className="btn btn-primary w-full">다 음</button>
      </form>
      {sessionStorage.getItem("devCode") && <p className="text-xs opacity-60">devCode: {sessionStorage.getItem("devCode")}</p>}
      {msg && <p className="text-red-500 text-sm">{msg}</p>}
    </div>
  );
}
