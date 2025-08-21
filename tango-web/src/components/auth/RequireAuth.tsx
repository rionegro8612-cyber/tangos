'use client';

import { useEffect, useState } from 'react';
import { fetchMe, convertMeToUser } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth'; // 기존 store와 병행

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useAuthStore((s) => s.setUser); // 기존 store 사용

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await fetchMe();
      if (!alive) return;
      if (me) {
        // 기존 store와 호환성 유지
        setUser(convertMeToUser(me));
        setAuthed(true);
        setReady(true);
      } else {
        setAuthed(false);
        setReady(true);
        // 로그인으로 보내되, 돌아올 경로 저장
        const next = encodeURIComponent(pathname || '/');
        router.replace(`/login?next=${next}`);
      }
    })();
    return () => { alive = false; };
  }, [router, pathname, setUser]);

  if (!ready) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <div className="animate-pulse text-sm text-gray-500">세션 확인 중…</div>
      </div>
    );
  }
  if (!authed) return null; // 리다이렉트 직전

  return <>{children}</>;
}
