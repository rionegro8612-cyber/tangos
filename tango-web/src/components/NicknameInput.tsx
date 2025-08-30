'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type CheckResp = { available: boolean; reason?: 'TAKEN'|'INVALID'|'BLOCKED' };

export default function NicknameInput(props: {
  value?: string;
  onChange?: (v: string) => void;
  onValid?: (v: string) => void;   // 사용 가능해졌을 때 콜백
  userId?: string;  // 사용자 ID 추가
}) {
  const [nick, setNick] = useState(props.value || '');
  const debounced = useDebouncedValue(nick, 400);
  const [status, setStatus] = useState<'idle'|'checking'|'ok'|'bad'|'error'>('idle');
  const [msg, setMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { props.onChange?.(nick); }, [nick]); // eslint-disable-line

  useEffect(() => {
    if (!debounced) { setStatus('idle'); setMsg(''); return; }

    // 간단한 클라단 규칙(길이/허용문자) — 서버 규칙과 맞추면 UX 부드러움
    const okLocal = debounced.length >= 2 && debounced.length <= 12 && /^[0-9a-zA-Z가-힣._-]+$/.test(debounced);
    if (!okLocal) {
      setStatus('bad');
      setMsg('2~12자, 한글/영문/숫자/._- 만 사용 가능');
      return;
    }

    // 이전 요청 취소
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        setStatus('checking');
        setMsg('사용 가능 여부 확인 중…');
        const r = await apiFetch<CheckResp>(`/api/v1/profile/nickname/check?value=${encodeURIComponent(debounced)}&userId=${props.userId || ''}`, {
          signal: ac.signal,
        });
        if (r.data?.available) {
          setStatus('ok');
          setMsg('사용 가능한 닉네임이에요.');
          props.onValid?.(debounced);
        } else {
          setStatus('bad');
          const reason = r.data?.reason || 'TAKEN';
          setMsg(reason === 'INVALID' ? '형식이 올바르지 않아요.' :
                reason === 'BLOCKED' ? '사용이 제한된 단어예요.' :
                '이미 사용 중인 닉네임이에요.');
        }
      } catch (e) {
        if ((e as any).name === 'AbortError') return;
        const err = e as ApiError;
        setStatus('error');
        setMsg(err.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : '확인 중 오류가 발생했어요.');
      }
    })();

    return () => ac.abort();
  }, [debounced]); // eslint-disable-line

  const color = useMemo(() => (
    status === 'ok' ? 'text-green-600' :
    status === 'bad' ? 'text-red-600' :
    status === 'checking' ? 'text-gray-500' :
    'text-gray-500'
  ), [status]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">닉네임</label>
      <input
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        placeholder="예) 따뜻한라떼"
        className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
        maxLength={12}
        aria-describedby="nickname-help"
      />
      <p id="nickname-help" className={`text-xs ${color}`} aria-live="polite">{msg}</p>
    </div>
  );
}
