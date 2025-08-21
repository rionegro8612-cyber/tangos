'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function LogoutButton() {
  const router = useRouter();
  const logout = useAuthStore(s => s.logout);

  const onClick = async () => {
    await logout();          // 서버 /logout + 스토어 비우기
    router.replace('/login'); // 로그인 화면으로 이동
  };

  return (
    <button onClick={onClick} style={{ padding: 8, border: '1px solid #ddd' }}>
      로그아웃
    </button>
  );
}
