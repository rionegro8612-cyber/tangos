'use client';
import { useState } from 'react';
import LocationAutocompleteV2 from '../../../components/LocationAutocompleteV2';
import LocationAutocompleteWrapper from '../../../components/LocationAutocompleteWrapper';

interface LocationData {
  name: string;
  lat: number;
  lng: number;
  regionCode?: string;
}

export default function LocationTestPage() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [useNewVersion, setUseNewVersion] = useState(true);

  const handleLocationSelect = (location: LocationData | undefined) => {
    if (location) {
      setSelectedLocation(location);
      console.log('선택된 위치:', location);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">위치 자동완성 테스트</h1>
        
        {/* 버전 선택 */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">컴포넌트 버전 선택</h2>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={useNewVersion}
                onChange={() => setUseNewVersion(true)}
                className="mr-2"
              />
              새로운 버전 (Kakao → VWorld 폴백)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={!useNewVersion}
                onChange={() => setUseNewVersion(false)}
                className="mr-2"
              />
              기존 버전 (백엔드 API)
            </label>
          </div>
        </div>

        {/* 위치 선택 */}
        <div className="mb-6 p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">위치 검색</h2>
          
          {useNewVersion ? (
            <LocationAutocompleteV2
              value={selectedLocation || undefined}
              onSelect={handleLocationSelect}
              label="지역 검색"
              placeholder="동/지하철역/장소를 입력하세요..."
              className="mb-4"
            />
          ) : (
            <LocationAutocompleteWrapper
              useNewVersion={false}
              onSelect={(item) => {
                if (item.lat && item.lng) {
                  handleLocationSelect({
                    name: item.name || item.label || '',
                    lat: item.lat,
                    lng: item.lng,
                    regionCode: item.regionCode || item.code || ''
                  });
                }
              }}
              placeholder="지역을 입력하세요..."
              className="mb-4"
            />
          )}

          {/* 선택된 위치 정보 */}
          {selectedLocation && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">선택된 위치</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>이름:</strong> {selectedLocation.name}</p>
                <p><strong>위도:</strong> {selectedLocation.lat.toFixed(6)}</p>
                <p><strong>경도:</strong> {selectedLocation.lng.toFixed(6)}</p>
                {selectedLocation.regionCode && (
                  <p><strong>행정구역 코드:</strong> {selectedLocation.regionCode}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 사용법 안내 */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">사용법</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>새로운 버전:</strong> 프론트엔드에서 직접 Kakao/VWorld API 호출</p>
            <p>• <strong>기존 버전:</strong> 백엔드 API를 통한 검색</p>
            <p>• <strong>디바운스:</strong> 250ms 후 검색 시작</p>
            <p>• <strong>캐시:</strong> 10분간 검색 결과 캐시</p>
            <p>• <strong>폴백:</strong> Kakao 실패 시 VWorld로 자동 전환</p>
          </div>
        </div>

        {/* 환경변수 안내 */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 환경변수 설정 필요</h3>
          <p className="text-sm text-yellow-700 mb-2">
            새로운 버전을 사용하려면 <code>.env.local</code> 파일에 다음을 추가하세요:
          </p>
          <pre className="text-xs bg-yellow-100 p-2 rounded overflow-x-auto">
{`NEXT_PUBLIC_KAKAO_REST_KEY=카카오_REST_API_키
NEXT_PUBLIC_VWORLD_KEY=브이월드_API_키`}
          </pre>
        </div>
      </div>
    </div>
  );
}
