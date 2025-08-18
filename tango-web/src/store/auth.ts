'use client';

import { create } from 'zustand';

export type User = {
  id: string | number;
  phone_e164_norm: string;
  nickname?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  // (UI 어딘가에서 phone을 참조한다면 주석 해제)
  // phone?: string | null;
};

type AuthState = {
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

const extractUser = (j: any): User | null =>
  j?.data?.user ?? j?.user ?? (typeof j?.data === 'object' ? j.data : null) ?? null;

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  user: null,

  setReady: (v) => set({ ready: v }),
  setUser: (u) => set({ user: u }),

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

