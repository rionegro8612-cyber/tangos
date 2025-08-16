'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/src/store/auth';

type Props = { children: React.ReactNode };

/** 로그인 안 되어 있으면 /login으로 이동하는 클라이언트 게이트 */
export default function AuthGate({ children }: Props) {
  const router = useRouter();
  const { ready, user } = useAuthStore();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  // 초기 로딩 또는 리다이렉트 중에는 렌더링하지 않음(필요시 로딩 UI 넣어도 됨)
  if (!ready || !user) return null;

  return <>{children}</>;
}
