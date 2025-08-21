// 위치 검색 라이브러리 (Kakao → VWorld 폴백)
export type LocItem = {
  name: string;        // 표출명 (예: "수원시 장안구 정자1동")
  address: string;     // 도로명 or 지번
  lat: number;
  lng: number;
  regionCode?: string; // 행정구역 코드(가능 시)
  source: 'kakao'|'vworld';
};

const cache = new Map<string, { at: number; items: LocItem[] }>();
const TTL = 10 * 60 * 1000; // 10분 캐시

function fromCache(q: string): LocItem[] | null {
  const hit = cache.get(q.trim());
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) { 
    cache.delete(q); 
    return null; 
  }
  return hit.items;
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocItem[]> {
  const q = query.trim();
  if (!q) return [];
  
  // 캐시 확인
  const cached = fromCache(q);
  if (cached) return cached;

  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_REST_KEY;
  const vworldKey = process.env.NEXT_PUBLIC_VWORLD_KEY;

  // 1) Kakao 키워드 검색 (우선)
  if (kakaoKey) {
    try {
      const r = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=5`, 
        {
          signal,
          headers: { Authorization: `KakaoAK ${kakaoKey}` }
        }
      );
      
      if (r.ok) {
        const j = await r.json();
        const items: LocItem[] = (j.documents || []).map((d: any) => ({
          name: d.place_name || d.address_name || q,
          address: d.road_address_name || d.address_name || '',
          lat: parseFloat(d.y),
          lng: parseFloat(d.x),
          regionCode: d.region_3depth_name, // 가용 시 추출
          source: 'kakao',
        }));
        
        if (items.length) {
          cache.set(q, { at: Date.now(), items });
          return items;
        }
      }
    } catch (error) {
      console.warn('[location] Kakao API 오류:', error);
      // 폴백으로 계속 진행
    }
  }

  // 2) VWorld 지오코딩 폴백
  if (vworldKey) {
    try {
      const vworldUrl = `https://api.vworld.kr/req/search?service=search&version=2.0&request=search&size=5&query=${encodeURIComponent(q)}&type=address&category=road&format=json&errorformat=json&key=${vworldKey}`;
      
      const r = await fetch(vworldUrl, { signal });
      if (r.ok) {
        const j = await r.json();
        const items: LocItem[] = (j.response?.result?.items || []).map((it: any) => ({
          name: it.title?.replace(/<[^>]+>/g, '') || q,
          address: it.address?.road || it.address?.parcel || '',
          lat: parseFloat(it.point?.y),
          lng: parseFloat(it.point?.x),
          regionCode: it.id, // 필요 시 별도 매핑
          source: 'vworld',
        }));
        
        if (items.length) {
          cache.set(q, { at: Date.now(), items });
          return items;
        }
      }
    } catch (error) {
      console.warn('[location] VWorld API 오류:', error);
    }
  }

  // 3) API 키가 없거나 모두 실패한 경우
  if (!kakaoKey && !vworldKey) {
    console.warn('[location] API 키가 설정되지 않음. .env.local에 NEXT_PUBLIC_KAKAO_REST_KEY와 NEXT_PUBLIC_VWORLD_KEY를 추가하세요.');
  }

  return [];
}

// 캐시 정리 (메모리 누수 방지)
export function clearLocationCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.at > TTL) {
      cache.delete(key);
    }
  }
}

// 주기적 캐시 정리 (선택사항)
if (typeof window !== 'undefined') {
  setInterval(clearLocationCache, 5 * 60 * 1000); // 5분마다
}
