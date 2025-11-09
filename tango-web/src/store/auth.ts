'use client';

import { create } from 'zustand';
import { sendSms as apiSendSms, verifyCode as apiVerifyCode, me as apiMe, logout as apiLogout, API_BASE } from '@/lib/api';

export type User = {
  id: string;
  phone: string;
  nickname: string | null;
  region: string | null;
  isVerified: boolean;
  kycProvider: string | null;
  kycVerified: boolean;
  kycCheckedAt: string | null;
  birthDate: string | null;
  age: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AuthState = {
  ready: boolean;
  user: User | null;
  setReady: (v: boolean) => void;
  setUser: (u: User | null) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
};

const extractUser = (j: any): User | null => {
  const root = j?.data?.user ?? j?.user ?? j?.data ?? j;
  if (!root || typeof root !== 'object') return null;

  const idSource =
    root.id ??
    root.userId ??
    root.uid ??
    root.user_id ??
    (typeof root === 'object' && 'id' in root ? (root as any).id : undefined);

  if (idSource === undefined || idSource === null) return null;

  const id = String(idSource);
  const createdAt = root.createdAt ?? root.created_at ?? null;
  const updatedAt = root.updatedAt ?? root.updated_at ?? null;

  const ageRaw = root.age ?? null;
  const age = typeof ageRaw === 'number' ? ageRaw : ageRaw ? Number(ageRaw) : null;

  const profile = root.profile ?? {};

  return {
    id,
    phone:
      root.phone ??
      root.phoneE164 ??
      root.phone_e164_norm ??
      profile.phone ??
      profile.phoneE164 ??
      profile.phone_e164_norm ??
      '',
    nickname: root.nickname ?? profile.nickname ?? null,
    region:
      root.region ??
      root.regionName ??
      profile.region ??
      profile.regionName ??
      (root.region?.label ?? root.region?.name ?? null),
    isVerified: root.isVerified ?? root.is_verified ?? profile.isVerified ?? false,
    kycProvider: root.kycProvider ?? root.kyc_provider ?? profile.kycProvider ?? null,
    kycVerified: root.kycVerified ?? root.kyc_verified ?? profile.kycVerified ?? false,
    kycCheckedAt: root.kycCheckedAt ?? root.kyc_checked_at ?? profile.kycCheckedAt ?? null,
    birthDate: root.birthDate ?? root.birth_date ?? profile.birthDate ?? null,
    age,
    createdAt: createdAt ? String(createdAt) : profile.createdAt ? String(profile.createdAt) : null,
    updatedAt: updatedAt ? String(updatedAt) : profile.updatedAt ? String(profile.updatedAt) : null,
  };
};

export const useAuthStore = create<AuthState>((set: (state: Partial<AuthState>) => void) => ({
  ready: false,
  user: null,

  setReady: (v: boolean) => set({ ready: v }),
  setUser: (u: User | null) => set({ user: u }),

  // 앱 시작 시 1회 실행: me → (401) refresh → me 재시도
  bootstrap: async () => {
    try {
      const response = await apiMe();
      set({ user: extractUser(response), ready: true });
    } catch (error: any) {
      if (error.status === 401) {
        try {
          // refresh 시도 (백엔드 직접 호출)
          await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include'
          });
          const me2 = await apiMe();
          set({ user: extractUser(me2), ready: true });
          return;
        } catch {
          // refresh 실패 시 로그아웃 상태
          set({ user: null, ready: true });
        }
      } else {
        set({ user: null, ready: true });
      }
    }
  },

  logout: async () => {
    try {
      await apiLogout();
    } finally {
      set({ user: null });
    }
  },
}));

// 기존 alias 호환
export const useAuth = useAuthStore;
export const normalizeUser = extractUser;

// 인증 관련 API 함수들 - 백엔드 직접 호출로 통일
export async function sendSms(phone: string) {
  return apiSendSms(phone);
}

export async function verifyCode(args: { phone: string; code: string; requestId: string }) {
  return apiVerifyCode(args.phone, args.code);
}

export async function me() {
  return apiMe();
}

