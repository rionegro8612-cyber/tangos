"use client";
import { useState, useCallback } from 'react';

export interface SignupDraft {
  phone?: string;
  carrier?: string;
  phoneVerified?: boolean;
  code?: string; // OTP 코드
  name?: string;
  birth?: string;
  gender?: "M" | "F" | ""; // 성별
  kycVerified?: boolean;
  terms?: { // 약관 동의
    tos: boolean;
    privacy: boolean;
    marketing?: boolean;
  };
  nickname?: string;
  regionCode?: string;
  regionLabel?: string;
}

export function useSignupDraft() {
  const [draft, setDraft] = useState<SignupDraft>({
    carrier: "SKT" // 기본 통신사 설정
  });

  const updateDraft = useCallback((updates: Partial<SignupDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft({});
  }, []);

  const getDraft = useCallback(() => draft, [draft]);

  return {
    draft,
    updateDraft,
    clearDraft,
    getDraft
  };
}