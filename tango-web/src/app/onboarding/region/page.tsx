"use client";
import { useState } from "react";
import { useAuthStore, normalizeUser } from "@/store/auth";
import LocationAutocompleteV2 from "@/components/LocationAutocompleteV2";
import { API_BASE } from "@/lib/api";

// 🆕 테스트 모드: 개발 환경에서만 활성화
const isTestMode = process.env.NODE_ENV !== "production";

type LocationValue = {
  name: string;
  lat: number;
  lng: number;
  regionCode?: string;
};

export default function RegionPage(){
  const [selectedLocation, setSelectedLocation] = useState<LocationValue | null>(null);
  const [manualInput, setManualInput] = useState(""); // 🆕 테스트 모드용 수동 입력
  const [msg, setMsg] = useState("");
  const setUser = useAuthStore(s => s.setUser);

  const onSave = async () => {
    // 🆕 테스트 모드: 수동 입력이 있으면 사용, 없으면 선택된 지역 사용
    let regionToSave: LocationValue | null = selectedLocation;
    
    if (isTestMode && !selectedLocation && manualInput.trim()) {
      // 테스트 모드에서 수동 입력만 있는 경우
      regionToSave = {
        name: manualInput.trim(),
        lat: 37.5665, // 서울 기본 좌표 (테스트용)
        lng: 126.9780,
      };
      console.log(`[region] 테스트 모드: 수동 입력 사용`, regionToSave);
    }
    
    if (!regionToSave) {
      setMsg("지역을 선택하거나 입력해주세요.");
      return;
    }
    
    try {
      // 🆕 회원가입 중이므로 지역을 sessionStorage에 저장
      // (회원가입 완료 시 함께 제출)
      window.sessionStorage.setItem("region", JSON.stringify({
        label: regionToSave.name,
        code: regionToSave.regionCode,
        lat: regionToSave.lat,
        lng: regionToSave.lng
      }));
      console.log(`[region] 지역 저장:`, regionToSave);
      
      // 2단계: 회원가입 완료 (sessionStorage에서 정보 가져오기)
      const phone = window.sessionStorage.getItem("phone");
      const name = window.sessionStorage.getItem("name");
      const birth = window.sessionStorage.getItem("birth");
      const gender = window.sessionStorage.getItem("gender");
      const termsStr = window.sessionStorage.getItem("terms");
      const nickname = window.sessionStorage.getItem("nickname"); // 🆕 닉네임 가져오기
      
      if (!phone || !name || !birth || !gender || !termsStr || !nickname) {
        setMsg("회원가입 정보가 누락되었습니다. 처음부터 다시 진행해주세요.");
        return;
      }
      
      const terms = JSON.parse(termsStr);
      const birthYear = new Date(birth).getFullYear();
      
      // 지역 정보 가져오기
      const regionStr = window.sessionStorage.getItem("region");
      if (!regionStr) {
        setMsg("지역 정보가 누락되었습니다. 지역을 다시 선택해주세요.");
        return;
      }
      const region = JSON.parse(regionStr);
      
      const signupBody = {
        phone,
        profile: {
          nickname: nickname,  // 🆕 닉네임 설정 페이지에서 저장한 닉네임 사용
          region: region.label,  // 🆕 지역 설정 페이지에서 저장한 지역 사용
          birthYear: birthYear
        },
        agreements: [
          {
            code: "TOS",
            version: "1.0",
            required: true,
            accepted: terms.tos
          },
          {
            code: "PRIVACY",
            version: "1.0", 
            required: true,
            accepted: terms.privacy
          }
        ]
      };
      
      console.log("[region] 회원가입 완료 요청:", signupBody);
      
      const signupRes = await fetch(`${API_BASE}/auth/register/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupBody)
      });
      
      const signupData = await signupRes.json();
      console.log("[region] 회원가입 완료 응답:", signupData);
      
      if (signupData.success) {
        const normalized = normalizeUser(signupData);
        if (normalized) {
          setUser(normalized);
        }
        // 회원가입 성공 - 세션 정리
        window.sessionStorage.removeItem("phone");
        window.sessionStorage.removeItem("carrier");
        window.sessionStorage.removeItem("phoneVerified");
        window.sessionStorage.removeItem("name");
        window.sessionStorage.removeItem("birth");
        window.sessionStorage.removeItem("gender");
        window.sessionStorage.removeItem("terms");
        window.sessionStorage.removeItem("nickname"); // 🆕 닉네임도 삭제
        window.sessionStorage.removeItem("region"); // 🆕 지역도 삭제
        window.sessionStorage.removeItem("devCode");
        
        // 홈으로 이동
        location.href = "/";
      } else {
        setMsg(signupData.message || "회원가입에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("[region] 오류:", error);
      setMsg(error.message || "저장 중 오류가 발생했습니다.");
    }
  };

  // 🆕 버튼 활성화 조건: 선택된 지역이 있거나 (테스트 모드에서) 수동 입력이 있으면 활성화
  const canSave = selectedLocation || (isTestMode && manualInput.trim().length > 0);

  return (
    <main className="mx-auto max-w-[430px] p-6">
      <h1 className="text-xl font-bold mb-4">동네 설정</h1>
      <p className="text-gray-600 mb-4">활동할 지역을 검색하여 선택해주세요.</p>
      
      <div className="mb-6">
        <LocationAutocompleteV2
          value={selectedLocation || undefined}
          onSelect={(location) => {
            if (location) {
              setSelectedLocation(location);
              setManualInput(""); // 선택 시 수동 입력 초기화
              setMsg(""); // 선택 시 메시지 초기화
              console.log("[region] 지역 선택:", location);
            }
          }}
          label="활동 지역"
          placeholder="동/구/시/지하철역/장소 검색"
        />
      </div>
      
      {/* 🆕 테스트 모드: 수동 입력 필드 (API 없이 테스트용) */}
      {isTestMode && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 mb-2">
            <strong>테스트 모드:</strong> API 없이 지역명을 직접 입력할 수 있습니다.
          </p>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              if (e.target.value.trim()) {
                setSelectedLocation(null); // 수동 입력 시 선택 해제
              }
              setMsg("");
            }}
            placeholder="지역명 직접 입력 (예: 강남구, 수원시)"
            className="w-full border rounded p-2 text-sm"
          />
        </div>
      )}
      
      {(selectedLocation || (isTestMode && manualInput.trim())) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">선택된 지역</p>
          <p className="text-sm text-gray-600">
            {selectedLocation?.name || manualInput.trim()}
          </p>
          {selectedLocation?.regionCode && (
            <p className="text-xs text-gray-500 mt-1">코드: {selectedLocation.regionCode}</p>
          )}
          {isTestMode && manualInput.trim() && !selectedLocation && (
            <p className="text-xs text-yellow-600 mt-1">테스트 모드: 수동 입력</p>
          )}
        </div>
      )}
      
      <button 
        className="w-full rounded-xl p-3 bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all" 
        disabled={!canSave} 
        onClick={onSave}
      >
        저장하고 시작하기
      </button>
      {msg && <p className={`mt-3 text-sm ${msg.includes("실패") || msg.includes("오류") ? "text-red-600" : "text-gray-600"}`}>{msg}</p>}
    </main>
  );
}