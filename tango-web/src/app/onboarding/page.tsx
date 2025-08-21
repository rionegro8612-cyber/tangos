'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NicknameInput from '../../components/NicknameInput';
import LocationAutocompleteV2 from '../../components/LocationAutocompleteV2';
import { apiFetch } from '../../lib/api';

interface LocationData {
  name: string;
  lat: number;
  lng: number;
  regionCode?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // sessionStorage에서 전화번호 가져오기
  useEffect(() => {
    const storedPhone = sessionStorage.getItem('phone');
    const phoneVerified = sessionStorage.getItem('phoneVerified');
    
    if (!storedPhone || !phoneVerified) {
      router.replace('/register/phone');
      return;
    }
    
    setPhone(storedPhone);
  }, [router]);

  // 프로필 저장
  async function submitProfile() {
    if (!nickname || !location) {
      setMessage('닉네임과 지역을 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // 프로필 저장 API 호출
      const response = await apiFetch('/api/v1/profile', {
        method: 'POST',
        body: JSON.stringify({
          nickname,
          regionName: location.name,
          regionCode: location.regionCode,
          lat: location.lat,
          lng: location.lng,
        }),
      });

      if (response.success) {
        setMessage('프로필이 저장되었습니다!');
        // 회원가입 완료 후 메인 페이지로 이동
        setTimeout(() => {
          // sessionStorage 정리
          sessionStorage.removeItem('phone');
          sessionStorage.removeItem('carrier');
          sessionStorage.removeItem('phoneVerified');
          sessionStorage.removeItem('devCode');
          router.push('/');
        }, 1500);
      } else {
        setMessage(response.message || '프로필 저장에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('프로필 저장 오류:', error);
      setMessage(error.message || '프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // 폼 완성도 체크
  const isFormComplete = nickname && location;

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-[430px] px-6 space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">프로필 설정</h1>
          <p className="text-gray-600">마지막 단계입니다. 프로필을 입력해 주세요</p>
        </header>

        {/* 진행 상태 표시 */}
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="text-sm font-medium text-gray-700 mb-3">진행 상황</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">휴대폰 인증</span>
              <span className="text-sm font-medium text-green-600">완료</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">기본 정보</span>
              <span className="text-sm font-medium text-green-600">완료</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">닉네임 설정</span>
              <span className={`text-sm font-medium ${nickname ? 'text-green-600' : 'text-gray-400'}`}>
                {nickname ? '완료' : '대기'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">지역 설정</span>
              <span className={`text-sm font-medium ${location ? 'text-green-600' : 'text-gray-400'}`}>
                {location ? '완료' : '대기'}
              </span>
            </div>
          </div>
        </div>

        {/* 닉네임 입력 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-blue-500 text-white">
              3
            </div>
            <h2 className="text-lg font-semibold">닉네임 설정</h2>
          </div>
          
          <NicknameInput
            value={nickname}
            onChange={setNickname}
            onValid={(validNickname) => {
              setNickname(validNickname);
              setMessage('사용 가능한 닉네임입니다.');
            }}
          />
        </section>

        {/* 지역 선택 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-blue-500 text-white">
              4
            </div>
            <h2 className="text-lg font-semibold">활동 지역</h2>
          </div>
          
          <LocationAutocompleteV2
            value={location || undefined}
            onSelect={(selectedLocation) => {
              if (selectedLocation) {
                setLocation(selectedLocation);
                setMessage(`${selectedLocation.name} 지역이 선택되었습니다.`);
              }
            }}
            label="활동 지역"
            placeholder="동/지하철역/장소를 검색하세요"
          />
        </section>

        {/* 프로필 저장 버튼 */}
        <div className="pt-4">
          <button
            onClick={submitProfile}
            disabled={!isFormComplete || isSubmitting}
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all ${
              isFormComplete && !isSubmitting
                ? 'bg-black text-white hover:bg-gray-800 active:scale-95'
                : 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
            }`}
          >
            {isSubmitting ? '저장 중...' : '회원가입 완료'}
          </button>
        </div>

        {/* 메시지 표시 */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('성공') || message.includes('완료')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : message.includes('실패') || message.includes('오류')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
