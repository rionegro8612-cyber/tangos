'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/src/store/auth';

/** 앱 전역에서 1회 실행하여 me/refresh 수행 후 ready=true로 전환 */
export default function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return null;
}
