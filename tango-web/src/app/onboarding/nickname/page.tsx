"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";

async function checkNickname(value: string, userId?: string){
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100/api/v1";
  const url = userId 
    ? `${base}/profile/nickname/check?value=${encodeURIComponent(value)}&userId=${encodeURIComponent(userId)}`
    : `${base}/profile/nickname/check?value=${encodeURIComponent(value)}`;
  
  const res = await fetch(url, {
    credentials: "include"
  });
  return res.json();
}

export default function NicknamePage(){
  const user = useAuthStore((s) => s.user);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle"|"checking"|"ok"|"dup"|"invalid">("idle");
  const [msg, setMsg] = useState("");

  // 규칙: 2~12자, 한/영/숫자/_(언더바) 허용
  const valid = useMemo(() => /^[\w가-힣]{2,12}$/.test(value), [value]);

  useEffect(() => {
    if (!value) { setStatus("idle"); setMsg(""); return; }
    if (!valid) { setStatus("invalid"); setMsg("닉네임은 2~12자, 한/영/숫자/_(언더바)만 가능"); return; }

    setStatus("checking");
    const t = setTimeout(async () => {
      try {
        const j = await checkNickname(value, user?.id?.toString());
        const ok = j?.data?.available === true;
        setStatus(ok ? "ok" : "dup");
        setMsg(ok ? "사용 가능한 닉네임입니다." : "이미 사용 중인 닉네임입니다.");
      } catch (error) {
        console.error("닉네임 체크 실패:", error);
        setStatus("invalid");
        setMsg("닉네임 확인 중 오류가 발생했습니다.");
      }
    }, 200); // 200ms 디바운스 (더 빠른 반응)

    return () => clearTimeout(t);
  }, [value, valid, user?.id]);

  const canNext = status === "ok";

  const onNext = async () => {
    if (!canNext) return;
    
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100/api/v1";
      const res = await fetch(`${base}/profile/nickname`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value })
      });
      
      const j = await res.json();
      if (j.success) {
        location.href = "/onboarding/region";
      } else {
        setMsg(j.message || "닉네임 저장에 실패했습니다.");
      }
    } catch (error) {
      setMsg("닉네임 저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">닉네임 설정</h1>
      <input
        className="w-full border rounded p-3"
        value={value}
        onChange={e=>setValue(e.target.value)}
        placeholder="닉네임을 입력하세요 (2~12자)"
      />
      <p className={`mt-2 text-sm ${status==="ok"?"text-green-600":status==="dup"||status==="invalid"?"text-red-600":"text-gray-500"}`}>{msg}</p>

      <button
        className="mt-6 w-full rounded-xl p-3 bg-black text-white disabled:opacity-40"
        disabled={!canNext}
        onClick={onNext}
      >
        다음
      </button>
    </main>
  );
}
