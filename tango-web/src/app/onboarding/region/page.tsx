"use client";
import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100";

export default function RegionPage(){
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<any|null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`${BASE}/api/v1/location/search?q=${encodeURIComponent(q)}`, { credentials:"include" });
      const j = await r.json();
      setItems(j?.data?.items ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const onSave = async () => {
    if (!sel) return;
    const r = await fetch(`${BASE}/api/v1/profile/region`, {
      method:"POST", credentials:"include",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ label: sel.label, code: sel.code, lat: sel.lat, lng: sel.lng })
    });
    const j = await r.json();
    if (j.success) location.href="/"; else setMsg(j.message || "저장 실패");
  };

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">동네 설정</h1>
      <input className="w-full border rounded p-3 mb-3" placeholder="동/구/시 검색" value={q} onChange={e=>setQ(e.target.value)} />
      <ul className="border rounded divide-y max-h-80 overflow-auto mb-4">
        {items.map((it:any, i:number)=>(
          <li key={i} className={`p-3 cursor-pointer ${sel?.label===it.label?"bg-gray-100":""}`} onClick={()=>setSel(it)}>
            <div className="font-medium">{it.label}</div>
            <div className="text-xs text-gray-500">{it.code??"-"} · {it.source}</div>
          </li>
        ))}
      </ul>
      <button className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-40" disabled={!sel} onClick={onSave}>저장하고 시작하기</button>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
    </main>
  );
}