'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../store/auth';
import type { AuthState } from '../store/auth';
import { API_BASE } from '../lib/api';

type AnyJson = Record<string, any> | null;

function pickUser(json: AnyJson) {
  // 서버 응답 형태가 {data:{user}}, {user}, {data} 등 다양해도 안전하게 파싱
  return (
    json?.data?.user ??
    json?.user ??
    (json?.data && typeof json.data === 'object' && 'id' in json.data ? json.data : null) ??
    null
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s: AuthState) => s.user);
  const setUser = useAuthStore((s: AuthState) => s.setUser);
  const [meLoading, setMeLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // lib/api.ts의 API_BASE 사용 (이미 /api/v1 포함됨)

  // 프로필 진입 시 유저가 없으면 /auth/me로 한번 보강
  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();

    (async () => {
      // 이미 사용자 정보가 있으면 API 호출하지 않음
      if (user) return;
      
      setMeLoading(true);
      try {
        const loadProfile = async (allowRetry = true): Promise<boolean> => {
          const res = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
            signal: ctl.signal,
          });

          if (!alive) return false;

          if (res.ok) {
            const text = await res.text();
            const json: AnyJson = text ? JSON.parse(text) : null;
            const u = pickUser(json);
            if (u) {
              setUser(u);
              return true;
            }
            console.error('User data not found in response:', json);
            return false;
          }

          if (res.status === 401 && allowRetry) {
            try {
              const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                signal: ctl.signal,
              });

              if (refreshRes.ok) {
                return await loadProfile(false);
              }
            } catch (refreshError) {
              if (alive) {
                console.error('Refresh failed:', refreshError);
              }
            }
          } else {
            console.error('Profile fetch failed:', res.status, res.statusText);
          }

          return false;
        };

        const ok = await loadProfile();
        if (!ok && alive) {
          router.replace('/login');
        }
      } catch (error) {
        if (alive) {
          console.error('Profile fetch error:', error);
          router.replace('/login');
        }
      } finally {
        if (alive) setMeLoading(false);
      }
    })();

    return () => {
      alive = false;
      ctl.abort();
    };
  }, [router, setUser, user]);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // 무시: 어차피 세션 정리/리디렉트
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
            <span className="text-gray-500">전화번호</span> :{" "}
            <b>{user.phone || "-"}</b>
          </div>
          <div>
            <span className="text-gray-500">닉네임</span> :{" "}
            <b>{user.nickname || "-"}</b>
          </div>
          <div>
            <span className="text-gray-500">활동 지역</span> :{" "}
            <b>{user.region || "-"}</b>
          </div>
          <div>
            <span className="text-gray-500">가입일</span> :{" "}
            <b>{user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</b>
          </div>
        </div>
      ) : (
        !meLoading && <p>로그인이 필요합니다. 잠시 후 로그인 페이지로 이동합니다…</p>
      )}
    </main>
  );
}
