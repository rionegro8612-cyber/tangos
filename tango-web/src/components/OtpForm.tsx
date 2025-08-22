'use client';
import { useEffect, useState } from 'react';
import { sendSms, verifyCode } from '../lib/api';
import { useCountdownMs } from '../hooks/useCountdown';

type SendResp = { 
  issued: boolean; 
  ttlSec: number; 
  devCode?: string;
  resendCooldownSec?: number; // 서버에서 재전송 쿨다운 정보 제공
};

type VerifyResp = { 
  userId: string; 
  autoLogin: boolean;
};

// 에러 타입 정의
interface ApiError {
  code?: string;
  status?: number;
  message?: string;
}

interface OtpFormProps {
  phone: string;
  onSuccess?: (result: VerifyResp) => void;
  onError?: (error: string) => void;
  autoSend?: boolean; // 첫 진입 시 자동 전송 여부
  className?: string;
}

export default function OtpForm({ 
  phone, 
  onSuccess, 
  onError, 
  autoSend = true,
  className = ''
}: OtpFormProps) {
  const [sent, setSent] = useState<SendResp | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [resendAt, setResendAt] = useState<number>(0); // 재전송 쿨다운 끝나는 epoch
  const [attempts, setAttempts] = useState(0); // 시도 횟수
  const [isLocked, setIsLocked] = useState(false); // 잠금 상태

  // OTP 만료 시간 계산 (서버 응답 기준, 없으면 기본값)
  const expiresAt = sent?.ttlSec 
    ? Date.now() + (sent.ttlSec * 1000)
    : Date.now() + (5 * 60 * 1000); // 기본 5분

  // 타이머 훅 사용
  const { mmss, isExpired } = useCountdownMs(expiresAt);
  const { mmss: resendMmss, isExpired: canResend } = useCountdownMs(resendAt || 0);

  // SMS 전송 함수
  async function handleSendSms() {
    if (busy || !canResend) return;
    
    setBusy(true);
    setMsg('');
    try {
      const response = await sendSms(phone, { dev: true }); // 개발 모드에서 devCode 표시
      
      if (response.success && response.data) {
        setSent(response.data);
        
        // 재전송 쿨다운 설정 (서버 기준 우선, 없으면 기본값)
        const cooldownSec = (response.data as SendResp).resendCooldownSec ?? 60;
        setResendAt(Date.now() + (cooldownSec * 1000));
        
        setMsg('인증번호를 전송했어요.');
        setCode(''); // 코드 입력 초기화
        setAttempts(0); // 시도 횟수 초기화
        setIsLocked(false); // 잠금 해제
      } else {
        setMsg('전송에 실패했어요.');
      }
    } catch (error: unknown) {
      console.error('SMS 전송 오류:', error);
      
      const apiError = error as ApiError;
      
      // 에러 코드별 메시지 처리
      if (apiError.code === 'OTP_RATE_LIMIT') {
        setMsg('요청이 많아요. 잠시 후 다시 시도해 주세요.');
        // 레이트리밋 시 쿨다운 설정
        setResendAt(Date.now() + (60 * 1000)); // 1분 후 재시도 가능
      } else if (apiError.status === 429) {
        setMsg('요청이 많아요. 잠시 후 다시 시도해 주세요.');
        setResendAt(Date.now() + (60 * 1000));
      } else {
        setMsg(apiError.message || '전송에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  }

  // OTP 검증 함수
  async function handleVerify() {
    if (busy || isExpired || code.length < 4 || isLocked) return;
    
    setBusy(true);
    setMsg('');
    try {
      const response = await verifyCode(phone, code);
      
      if (response.success && response.data) {
        setMsg('인증 성공! 다음 단계로 이동합니다.');
        onSuccess?.(response.data);
      } else {
        setMsg('인증에 실패했어요.');
        setAttempts(prev => prev + 1);
      }
    } catch (error: unknown) {
      console.error('OTP 검증 오류:', error);
      
      const apiError = error as ApiError;
      
      // 에러 코드별 메시지 처리
      if (apiError.code === 'OTP_EXPIRED') {
        setMsg('인증번호가 만료되었어요. 재전송해 주세요.');
      } else if (apiError.code === 'OTP_LOCKED') {
        setMsg('시도 횟수가 초과되었어요. 잠시 후 다시 시도해 주세요.');
        setIsLocked(true);
        setResendAt(Date.now() + (10 * 60 * 1000)); // 10분 후 재시도 가능
      } else if (apiError.code === 'OTP_MISMATCH' || apiError.code === 'OTP_INVALID') {
        setMsg('인증번호가 올바르지 않아요.');
        setAttempts(prev => prev + 1);
        
        // 시도 횟수 제한 (5회)
        if (attempts >= 4) { // 0부터 시작하므로 4
          setIsLocked(true);
          setMsg('시도 횟수가 초과되었어요. 재전송해 주세요.');
          setResendAt(Date.now() + (5 * 60 * 1000)); // 5분 후 재시도 가능
        }
      } else if (apiError.status === 429) {
        setMsg('요청이 많아요. 잠시 후 다시 시도해 주세요.');
      } else {
        setMsg(apiError.message || '인증에 실패했어요.');
      }
      
      onError?.(apiError.message || '인증 실패');
    } finally {
      setBusy(false);
    }
  }

  // 첫 진입 시 자동 전송
  useEffect(() => { 
    if (autoSend && !sent) { 
      void handleSendSms(); 
    } 
  }, [autoSend]); // eslint-disable-line

  // 입력 필드 비활성화 조건
  const isInputDisabled = isExpired || busy || isLocked;
  const isVerifyDisabled = busy || isExpired || code.length < 4 || isLocked;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-2xl border p-4 bg-white">
        {/* 타이머 및 재전송 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-500">인증번호 유효시간</div>
            <div className={`text-xl font-semibold ${
              isExpired ? 'text-red-600' : 'text-gray-900'
            }`}>
              {isExpired ? '00:00' : mmss}
            </div>
          </div>
          
          <button
            onClick={handleSendSms}
            disabled={busy || !canResend}
            className={`rounded-xl px-3 py-2 text-sm border transition-colors ${
              busy || !canResend 
                ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                : 'hover:bg-gray-50 hover:border-gray-300'
            }`}
            aria-disabled={busy || !canResend}
            title={!canResend ? `재전송 가능까지 ${resendMmss}` : '인증번호 재전송'}
          >
            {canResend ? '재전송' : `재전송 ${resendMmss}`}
          </button>
        </div>

        {/* OTP 입력 필드 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            인증번호 {isLocked && <span className="text-red-600">(잠금됨)</span>}
          </label>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            disabled={isInputDisabled}
            placeholder="6자리 숫자"
            className={`w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10 transition-colors ${
              isInputDisabled 
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                : 'focus:border-black'
            }`}
            aria-describedby="otp-help"
          />
          
          <p id="otp-help" className="mt-2 text-sm text-gray-500" aria-live="polite">
            {isExpired 
              ? '만료되었습니다. 재전송 후 다시 시도해 주세요.' 
              : isLocked 
                ? '시도 횟수 초과로 잠금되었습니다. 재전송 후 다시 시도해 주세요.'
                : '메시지가 오지 않으면 재전송을 눌러주세요.'
            }
          </p>
          
          {/* 시도 횟수 표시 */}
          {attempts > 0 && (
            <p className="mt-1 text-xs text-orange-600">
              시도 횟수: {attempts}/5
            </p>
          )}
        </div>

        {/* 확인 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleVerify}
            disabled={isVerifyDisabled}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              isVerifyDisabled
                ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
                : 'bg-black text-white hover:bg-gray-800 active:scale-95'
            }`}
          >
            {busy ? '확인 중...' : '확인'}
          </button>
        </div>

        {/* 메시지 표시 */}
        {msg && (
          <p className={`mt-3 text-sm p-2 rounded-lg ${
            msg.includes('성공') 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : msg.includes('실패') || msg.includes('오류')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`} aria-live="polite">
            {msg}
          </p>
        )}

        {/* 개발 모드에서 devCode 표시 */}
        {sent?.devCode && process.env.NODE_ENV !== 'production' && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>개발 모드:</strong> 인증번호 {sent.devCode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
