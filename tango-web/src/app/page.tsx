'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/src/store/auth';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [meLoading, setMeLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || '';

  // 프로필 진입 시 유저가 없으면 /auth/me로 한번 보강
  useEffect(() => {
    let alive = true;
    (async () => {
      if (user) return;
      setMeLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/v1/auth/me`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!alive) return;

        if (res.ok && json?.success && json?.data?.user) {
          setUser(json.data.user);
        } else {
          // 토큰 없거나 만료 → 로그인으로
          router.replace('/login');
        }
      } catch {
        if (alive) router.replace('/login');
      } finally {
        if (alive) setMeLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiBase, router, setUser, user]);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await fetch(`${apiBase}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      setUser(null);
      router.replace('/login');
    } catch (e) {
      console.error('[logout] failed', e);
      alert('로그아웃 중 문제가 발생했습니다.');
    } finally {
      setLogoutLoading(false);
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
            <span className="text-gray-500">전화번호</span> :{' '}
            <b>{user.phone_e164_norm}</b>
          </div>
          <div>
            <span className="text-gray-500">닉네임</span> :{' '}
            <b>{user.nickname ?? '-'}</b>
          </div>
          <div>
            <span className="text-gray-500">마지막 로그인</span> :{' '}
            <b>{user.last_login_at}</b>
          </div>
          <div>
            <span className="text-gray-500">가입일</span> :{' '}
            <b>{user.created_at}</b>
          </div>
        </div>
      ) : (
        !meLoading && <p>로그인이 필요합니다. 잠시 후 로그인 페이지로 이동합니다…</p>
      )}
    </main>
  );
}
