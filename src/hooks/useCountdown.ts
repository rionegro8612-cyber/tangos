"use client";
import { useEffect, useState } from "react";

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