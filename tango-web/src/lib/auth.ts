import { me as apiMe } from '@/lib/api';

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
    const r = await apiMe();
    return r.data!;
  } catch (e: any) {
    if (e.status === 401) return null;
    throw e;
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
