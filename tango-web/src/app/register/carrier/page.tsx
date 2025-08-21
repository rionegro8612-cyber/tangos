"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterCarrierPage() {
  const r = useRouter();
  const [carrier, setCarrier] = useState("SKT");
  const phone = sessionStorage.getItem("phone");

  useEffect(()=>{ 
    if (!phone) {
      r.replace("/register/phone");
      return;
    }
  }, [phone, r]);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      r.replace("/register/phone");
      return;
    }
    sessionStorage.setItem("carrier", carrier);
    r.push("/register/info"); // OTP 발송 대신 info 페이지로 이동
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
