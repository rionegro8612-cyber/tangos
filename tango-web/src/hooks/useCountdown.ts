"use client";
import { useEffect, useState, useMemo, useRef } from "react";

// 기존 useCountdown (하위 호환성 유지)
export function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [left]);

  const reset = (sec: number) => setLeft(sec);

  return { left, reset, isActive: left > 0 };
}

// 새로운 useCountdown (밀리초 단위, requestAnimationFrame 사용)
export function useCountdownMs(targetEpochMs: number) {
  const [now, setNow] = useState(() => Date.now());
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const remainMs = Math.max(0, targetEpochMs - now);
  const isExpired = remainMs <= 0;
  const mm = Math.floor(remainMs / 1000 / 60);
  const ss = Math.floor((remainMs / 1000) % 60);
  const mmss = useMemo(() => `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, [mm, ss]);

  return { remainMs, isExpired, mmss };
}