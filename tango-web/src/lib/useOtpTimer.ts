"use client";
import { useState, useEffect, useCallback } from 'react';

interface UseOtpTimerReturn {
  remain: number;
  label: string;
  reset: (seconds: number) => void;
  isExpired: boolean;
}

export function useOtpTimer(initialSeconds: number = 0): UseOtpTimerReturn {
  const [remain, setRemain] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(initialSeconds === 0);

  const reset = useCallback((seconds: number) => {
    setRemain(seconds);
    setIsExpired(false);
  }, []);

  useEffect(() => {
    if (remain <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setRemain((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remain]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    remain,
    label: formatTime(remain),
    reset,
    isExpired
  };
}