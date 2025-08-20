"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/src/lib/api";


export default function RegionPage() {
const r = useRouter();
const [code, setCode] = useState("");
const [label, setLabel] = useState("");
const [msg, setMsg] = useState("");


async function submit() {
setMsg("");
try {
await api<{ ok: boolean }>("/profile/region", {
method: "POST", body: JSON.stringify({ regionCode: code, regionLabel: label })
});
r.push("/");
} catch (e:any) { setMsg(e.message); }
}


return (
<div className="max-w-md mx-auto p-6 space-y-4">
<h1 className="text-2xl font-bold">활동 지역 설정</h1>
<input className="input input-bordered w-full" placeholder="예: 41111123" value={code} onChange={(e)=>setCode(e.target.value)} />
<input className="input input-bordered w-full" placeholder="예: 수원시 장안구 파장동" value={label} onChange={(e)=>setLabel(e.target.value)} />
<button className="btn btn-primary w-full" onClick={submit} disabled={!code || !label}>완료</button>
{msg && <p className="text-red-500 text-sm">{msg}</p>}
</div>
);
}