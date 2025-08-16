'use client';

import { create } from 'zustand';

type User = {
  id: string | number;
  phone_e164_norm: string;
  nickname?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  setReady: (v: boolean) => void;
  setUser: (u: User | null) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
  'http://localhost:4100';

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  user: null,

  setReady: (v) => set({ ready: v }),
  setUser: (u) => set({ user: u }),

  // 앱 시작 시 1회 실행: me → (401) refresh → me 재시도
  bootstrap: async () => {
    try {
      const me = await fetch(`${API_BASE}/api/v1/auth/me`, {
        credentials: 'include',
      });

      if (me.ok) {
        const j = await me.json();
        set({ user: j.data?.user ?? null, ready: true });
        return;
      }

      // 401이면 refresh 시도
      if (me.status === 401) {
        const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) {
          // refresh 성공 시 me 다시
          const me2 = await fetch(`${API_BASE}/api/v1/auth/me`, {
            credentials: 'include',
          });
          if (me2.ok) {
            const j2 = await me2.json();
            set({ user: j2.data?.user ?? null, ready: true });
            return;
          }
        }
      }

      // 실패하면 비로그인으로 마킹
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
      });
    } finally {
      set({ user: null });
    }
  },
}));

// ✅ 기존 코드에서 `useAuth`를 쓰고 있다면 이 alias로 바로 호환됩니다.
export const useAuth = useAuthStore;
