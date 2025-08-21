'use client';
import { useState } from 'react';
import OtpForm from '../../../components/OtpForm';

interface VerifyResult {
  userId: string;
  autoLogin: boolean;
}

export default function OtpTestPage() {
  const [phone, setPhone] = useState('+821012345678');
  const [message, setMessage] = useState('');

  const handleOtpSuccess = (result: VerifyResult) => {
    setMessage(`인증 성공! 사용자 ID: ${result.userId}, 자동 로그인: ${result.autoLogin}`);
  };

  const handleOtpError = (error: string) => {
    setMessage(`인증 실패: ${error}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">OTP 폼 테스트</h1>
        
        {/* 전화번호 입력 */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">테스트 전화번호</h2>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+821012345678"
            className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
          />
          <p className="mt-2 text-sm text-gray-500">
            테스트용 전화번호를 입력하세요. 실제 SMS는 전송되지 않습니다.
          </p>
        </div>

        {/* OTP 폼 */}
        <div className="mb-6 p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">OTP 인증</h2>
          <OtpForm
            phone={phone}
            onSuccess={handleOtpSuccess}
            onError={handleOtpError}
            autoSend={false}
          />
        </div>

        {/* 결과 메시지 */}
        {message && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">결과</h3>
            <p className="text-blue-800">{message}</p>
          </div>
        )}

        {/* 기능 설명 */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">주요 기능</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>5분 타이머:</strong> OTP 유효시간 실시간 카운트다운</p>
            <p>• <strong>자동 만료:</strong> 시간 초과 시 입력 필드 비활성화</p>
            <p>• <strong>재전송 제한:</strong> 서버 응답에 따른 쿨다운 타이머</p>
            <p>• <strong>시도 횟수 제한:</strong> 5회 실패 시 잠금 (5분)</p>
            <p>• <strong>에러 코드별 처리:</strong> OTP_EXPIRED, OTP_LOCKED 등</p>
            <p>• <strong>개발 모드:</strong> devCode로 인증번호 표시</p>
            <p>• <strong>접근성:</strong> ARIA 속성, 키보드 네비게이션</p>
          </div>
        </div>

        {/* 사용법 */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">사용법</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>1. <strong>전화번호 입력:</strong> 위에서 테스트용 전화번호 설정</p>
            <p>2. <strong>재전송 버튼:</strong> OTP 발송 시작</p>
            <p>3. <strong>인증번호 입력:</strong> 6자리 숫자 입력</p>
            <p>4. <strong>확인 버튼:</strong> 인증 시도</p>
            <p>5. <strong>결과 확인:</strong> 성공/실패 메시지 확인</p>
          </div>
        </div>

        {/* 개발 모드 안내 */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 개발 모드 설정</h3>
          <p className="text-sm text-yellow-700 mb-2">
            OTP 인증번호를 화면에 표시하려면:
          </p>
          <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
            <li>백엔드에서 <code>DEBUG_OTP=1</code> 환경변수 설정</li>
            <li>또는 <code>dev: true</code> 옵션으로 SMS 전송</li>
            <li>인증번호가 노란색 박스에 표시됨</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
