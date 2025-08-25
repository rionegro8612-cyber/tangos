'use client';

import { create } from 'zustand';
import { api, sendSms as apiSendSms, verifyCode as apiVerifyCode, me as apiMe, logout as apiLogout, API_BASE } from '@/lib/api';

export type User = {
  id: number;
  phone: string;
  nickname: string | null;
  isVerified: boolean;
  kycProvider: string | null;
  kycVerified: boolean;
  kycCheckedAt: string | null;
  birthDate: string | null;
  age: number | null;
  createdAt: string;
  updatedAt: string;
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
  // 백엔드 응답 형식에 맞춤
  const userData = j?.data ?? j;
  if (!userData || typeof userData !== 'object') return null;
  
  // 필수 필드 확인
  if (typeof userData.id !== 'number') return null;
  
  return {
    id: userData.id,
    phone: userData.phone ?? '',
    nickname: userData.nickname ?? null,
    isVerified: userData.isVerified ?? false,
    kycProvider: userData.kycProvider ?? null,
    kycVerified: userData.kycVerified ?? false,
    kycCheckedAt: userData.kycCheckedAt ?? null,
    birthDate: userData.birthDate ?? null,
    age: userData.age ?? null,
    createdAt: userData.createdAt ?? new Date().toISOString(),
    updatedAt: userData.updatedAt ?? new Date().toISOString(),
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

