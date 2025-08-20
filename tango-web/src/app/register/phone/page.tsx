"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPhonePage() {
  const r = useRouter();
  const [phone, setPhone] = useState("");

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    sessionStorage.setItem("phone", phone);
    r.push("/register/carrier");
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">휴대폰 번호 입력</h1>
      <form onSubmit={next} className="space-y-3">
        <input className="input input-bordered w-full" placeholder="+8210xxxxxxx"
               value={phone} onChange={(e)=>setPhone(e.target.value)} required />
        <button className="btn btn-primary w-full">다 음</button>
      </form>
      <p className="text-xs opacity-70">입력하신 번호는 공개되지 않습니다.</p>
    </div>
  );
}
