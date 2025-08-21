// Node 18+ 가정: fetch 내장
import fs from "fs";
import path from "path";

type LocItem = { 
  label: string; 
  code?: string; 
  lat?: number; 
  lng?: number; 
  source: "kakao" | "vworld" | "local" 
};

const KAKAO_KEY = process.env.KAKAO_REST_KEY;
const VWORLD_KEY = process.env.VWORLD_KEY;
const localPath = path.join(process.cwd(), "resources", "regions_kr.sample.json");

function normalizeQ(q: string) { 
  return q.trim().replace(/\s+/g, " "); 
}

function norm(
  label?: string,
  lat?: number | null,
  lng?: number | null,
  code?: string | null,
  source: "kakao"|"vworld"|"local" = "local"
): LocItem | null {
  const L = (label || "").trim();
  if (!L) return null;

  // 선택 속성은 '정의된 경우'에만 포함해서 null을 제거
  const out: LocItem = {
    label: L,
    source,
    ...(lat  != null ? { lat:  Number(lat) } : {}),
    ...(lng  != null ? { lng:  Number(lng) } : {}),
    ...(code != null && code !== "" ? { code: String(code) } : {}),
  };
  return out;
}

export async function searchLocation(qRaw: string): Promise<LocItem[]> {
  const q = normalizeQ(qRaw);
  if (!q) return [];
  
  const results: LocItem[] = [];

  // 1) Kakao (키워드 검색 → 주소/장소)
  if (KAKAO_KEY) {
    try {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.searchParams.set("query", q);
      url.searchParams.set("size", "10");
      const r = await fetch(url, { 
        headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
      });
      if (r.ok) {
        const j: any = await r.json();
        for (const d of (j.documents ?? [])) {
          const label = d.place_name || d.address_name || d.road_address_name;
          const lat = d.y ? Number(d.y) : (d.latitude ? Number(d.latitude) : undefined);
          const lng = d.x ? Number(d.x) : (d.longitude ? Number(d.longitude) : undefined);
          const item = norm(label, lat, lng, /*code*/ null, "kakao");
          if (item) results.push(item);
        }
      }
    } catch (e) {
      console.warn("[location] Kakao API 오류:", e);
    }
  }

  // 2) VWorld (행정구역/주소 보강)
  if (VWORLD_KEY) {
    try {
      const url = new URL("https://api.vworld.kr/req/search");
      url.searchParams.set("service", "search");
      url.searchParams.set("request", "search");
      url.searchParams.set("version", "2.0");
      url.searchParams.set("size", "10");
      url.searchParams.set("query", q);
      url.searchParams.set("type", "place"); // 필요 시 'district' 등으로 교체
      url.searchParams.set("format", "json");
      url.searchParams.set("key", VWORLD_KEY);
      const r = await fetch(url);
      if (r.ok) {
        const j: any = await r.json();
        const items = j?.response?.result?.items ?? [];
        for (const it of items) {
          const label = it.title || it.address?.road || it.address?.parcel;
          const lat = it.point?.y ? Number(it.point.y) : undefined;
          const lng = it.point?.x ? Number(it.point.x) : undefined;
          const vitem = norm(label, lat, lng, /*code*/ null, "vworld");
          if (vitem) results.push(vitem);
        }
      }
    } catch (e) {
      console.warn("[location] VWorld API 오류:", e);
    }
  }

  // 3) Fallback: 로컬 JSON (간단 자동완성)
  if (!KAKAO_KEY && !VWORLD_KEY) {
    try {
      const raw = fs.readFileSync(localPath, "utf8");
      const arr = JSON.parse(raw) as any[];
      const qlc = q.toLowerCase();
      const filtered = arr.filter(x => 
        String(x.label).toLowerCase().includes(qlc)
      ).slice(0, 10);
      
      for (const f of filtered) {
        const lit = norm(f.label, f.lat ?? null, f.lng ?? null, f.code ?? null, "local");
        if (lit) results.push(lit);
      }
    } catch (e) {
      console.warn("[location] 로컬 JSON 읽기 오류:", e);
    }
  }

  // 중복 제거(라벨 기준)
  const seen = new Set<string>();
  return results.filter(it => {
    const k = `${it.label}|${it.lat}|${it.lng}`;
    if (seen.has(k)) return false;
    seen.add(k); 
    return true;
  }).slice(0, 10);
}
