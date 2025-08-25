"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { useState, useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    // 클라이언트 전용 초기화는 여기서만
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    setSupabase(client);
    setReady(true);
  }, []);

  if (!ready || !supabase) {
    return <div>로딩 중...</div>; // 또는 스켈레톤
  }

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
}
