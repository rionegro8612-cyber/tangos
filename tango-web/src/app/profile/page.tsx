'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/src/store/auth';

type AnyJson = Record<string, any> | null;

function pickUser(json: AnyJson) {
  return json?.data?.user ?? json?.user ?? (typeof json?.data === 'object' ? json?.data : null) ?? null;
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [meLoading, setMeLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const apiBase =
    (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4100').replace(
      /\/+$/,
      ''
    );

  async function fetchMeWithFallback(): Promise<boolean> {
    const urls = [`${apiBase}/api/v1/auth/me`, `${apiBase}/api/v1/me`];
    for (const url of urls) {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const txt = await res.text();
        const json: AnyJson = txt ? JSON.parse(txt) : null;
        const u = pickUser(json);
        setUser(u || null);
        return !!u;
      }
      if (res.status !== 404) break; // 404만 대체, 그 외 에러는 중단
    }
    return false;
  }

  async function logoutWithFallback() {
    const urls = [`${apiBase}/api/v1/auth/logout`, `${apiBase}/api/v1/logout`];
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (r.ok || r.status === 401 || r.status === 204) return;
      } catch {
        /* try next */
      }
    }
  }

  // 프로필 진입 시 유저가 없으면 me로 보강(404면 폴백)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (user) return;
      setMeLoading(true);
      const ok = await fetchMeWithFallback().catch(() => false);
      if (!alive) return;
      setMeLoading(false);
      if (!ok) router.replace('/login');
    })();
    return () => {
      alive = false;
    };
  }, [apiBase, router, setUser, user]);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await logoutWithFallback();
    } finally {
      setLogoutLoading(false);
      setUser(null);
      router.replace('/login');
    }
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">내 프로필</h1>
        <div className="flex gap-3">
          <Link className="underline" href="/">
            홈
          </Link>
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="rounded bg-black px-3 py-1 text-white disabled:opacity-60"
          >
            {logoutLoading ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </div>

      {meLoading && <p>불러오는 중…</p>}

      {user ? (
        <div className="space-y-2 rounded-xl border p-4">
          <div>
            <span className="text-gray-500">ID</span> : <b>{user.id}</b>
          </div>
          <div>
            <span className="text-gray-500">전화번호</span> : <b>{(user as any).phone_e164_norm ?? (user as any).phone ?? '-'}</b>
          </div>
          <div>
            <span className="text-gray-500">닉네임</span> : <b>{(user as any).nickname ?? '-'}</b>
          </div>
          <div>
            <span className="text-gray-500">마지막 로그인</span> : <b>{(user as any).last_login_at ?? '-'}</b>
          </div>
          <div>
            <span className="text-gray-500">가입일</span> : <b>{(user as any).created_at ?? '-'}</b>
          </div>
        </div>
      ) : (
        !meLoading && <p>로그인이 필요합니다. 잠시 후 로그인 페이지로 이동합니다…</p>
      )}
    </main>
  );
}
