'use client';

import { create } from 'zustand';

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

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4100'
).replace(/\/+$/, '');

const safeJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
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
      const me = await fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' });
      if (me.ok) {
        const j = await safeJson(me);
        set({ user: extractUser(j), ready: true });
        return;
      }

      if (me.status === 401) {
        const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) {
          const me2 = await fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' });
          const j2 = await safeJson(me2);
          set({ user: extractUser(j2), ready: true });
          return;
        }
      }

      set({ user: null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      set({ user: null });
    }
  },
}));

// 기존 alias 호환
export const useAuth = useAuthStore;

