'use client';
import { useEffect, useRef, useState } from 'react';
import { searchLocations, LocItem } from '../lib/location';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type Props = {
  value?: { name: string; lat: number; lng: number; regionCode?: string };
  onSelect?: (v: Props['value']) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

export default function LocationAutocompleteV2({ 
  value, 
  onSelect, 
  label = '지역', 
  placeholder = '동/지하철역/장소 검색',
  className = ''
}: Props) {
  const [q, setQ] = useState(value?.name || '');
  const debounced = useDebouncedValue(q, 250); // 250ms 디바운스
  const [items, setItems] = useState<LocItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debounced) { 
      setItems([]); 
      setOpen(false); 
      return; 
    }
    
    // 이전 요청 취소
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    (async () => {
      try {
        setLoading(true);
        const res = await searchLocations(debounced, ac.signal);
        setItems(res);
        setOpen(res.length > 0);
      } catch (error) {
        if ((error as any).name === 'AbortError') return;
        console.error('[LocationAutocomplete] 검색 오류:', error);
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debounced]);

  const handleSelect = (item: LocItem) => {
    setQ(item.name);
    setOpen(false);
    onSelect?.({
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      regionCode: item.regionCode
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
    if (e.target.value.trim()) {
      setOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (items.length > 0) {
      setOpen(true);
    }
  };

  const handleInputBlur = () => {
    // 약간의 지연으로 클릭 이벤트가 처리되도록
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium mb-2">{label}</label>
      )}
      
      <input
        value={q}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="loc-listbox"
        autoComplete="off"
      />
      
      {loading && (
        <p className="mt-1 text-sm text-gray-500">검색 중…</p>
      )}

      {open && items.length > 0 && (
        <ul
          id="loc-listbox"
          className="absolute z-10 mt-2 w-full max-h-60 overflow-auto rounded-xl border bg-white shadow-lg"
          role="listbox"
        >
          {items.map((it, i) => (
            <li
              key={`${it.source}-${i}-${it.name}`}
              role="option"
              tabIndex={0}
              onClick={() => handleSelect(it)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(it);
                }
              }}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer focus:bg-gray-50 focus:outline-none"
            >
              <div className="text-sm font-medium">{it.name}</div>
              <div className="text-xs text-gray-500">{it.address}</div>
              <div className="text-xs text-gray-400 mt-1">
                {it.source === 'kakao' ? '카카오' : 'VWorld'} • 
                {it.lat.toFixed(4)}, {it.lng.toFixed(4)}
                {it.regionCode && ` • ${it.regionCode}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
