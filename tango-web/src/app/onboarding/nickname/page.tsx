"use client";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/api";
import { useEffect, useMemo, useState } from "react";


export default function NicknamePage() {
const r = useRouter();
const [nick, setNick] = useState("");
const [available, setAvailable] = useState<boolean | null>(null);
const [msg, setMsg] = useState("");


useEffect(() => {
const t = setTimeout(async () => {
if (!nick) { setAvailable(null); return; }
try {
const res = await api<{ available: boolean }>(`/profile/nickname/check?value=${encodeURIComponent(nick)}`);
setAvailable(res.data.available);
} catch { setAvailable(null); }
}, 500);
return () => clearTimeout(t);
}, [nick]);


async function submit() {
setMsg("");
try {
await api<{ ok: boolean }>("/profile/nickname", {
method: "POST", body: JSON.stringify({ nickname: nick })
});
r.push("/onboarding/region");
} catch (e:any) { setMsg(e.message); }
}


return (
<div className="max-w-md mx-auto p-6 space-y-4">
<h1 className="text-2xl font-bold">닉네임 설정</h1>
<input className="input input-bordered w-full" value={nick} onChange={(e)=>setNick(e.target.value)} placeholder="닉네임" />
{available!==null && (
<p className={available?"text-green-600":"text-red-500"}>
{available?"사용 가능한 닉네임입니다":"사용할 수 없는 닉네임이에요"}
</p>
)}
<button className="btn btn-primary w-full" onClick={submit} disabled={!nick || available===false}>다음</button>
{msg && <p className="text-red-500 text-sm">{msg}</p>}
</div>
);
}