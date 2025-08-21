import { ApiError, apiFetchNew } from '@/lib/api';

export type Me = {
  userId: string;
  nickname?: string;
  phone?: string;
  // 기존 user 타입과 호환성 유지
  id?: string;
  phone_e164_norm?: string;
  created_at?: string;
  last_login_at?: string;
};

export async function fetchMe(): Promise<Me|null> {
  try {
    const r = await apiFetchNew<Me>('/api/v1/auth/me', {
      method: 'GET',
      credentials: 'include', // 쿠키로 인증
      headers: { /* 절대 X-User-Id 넣지 않기 */ },
    });
    return r.data!;
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401) return null;
    throw err;
  }
}

// 기존 useAuthStore와 호환성을 위한 변환 함수
export function convertMeToUser(me: Me) {
  return {
    id: Number(me.userId || me.id || 0),
    phone: me.phone || me.phone_e164_norm || '',
    nickname: me.nickname || null,
    isVerified: true, // 기본값
    kycProvider: null, // 기본값
    kycVerified: false, // 기본값
    kycCheckedAt: null, // 기본값
    birthDate: null, // 기본값
    age: null, // 기본값
    createdAt: me.created_at || new Date().toISOString(),
    updatedAt: me.last_login_at || new Date().toISOString(),
  };
}
