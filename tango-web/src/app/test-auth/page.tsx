'use client';

import { useState } from 'react';
import { sendSms, verifyCode } from '@/lib/api';

export default function TestAuthPage() {
  const [phone, setPhone] = useState('01087654321');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSendSms = async () => {
    setLoading(true);
    try {
      const response = await sendSms(phone);
      setResult({ type: 'SMS Sent', data: response });
    } catch (error: any) {
      setResult({ type: 'SMS Error', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      const response = await verifyCode(phone, code);
      setResult({ type: 'Code Verified', data: response });
    } catch (error: any) {
      setResult({ type: 'Verification Error', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">인증 플로우 테스트</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">전화번호</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="01012345678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">OTP 코드</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="123456"
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleSendSms}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? '전송 중...' : 'SMS 전송'}
          </button>

          <button
            onClick={handleVerifyCode}
            disabled={loading || !code}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {loading ? '검증 중...' : '코드 검증'}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 border rounded">
            <h3 className="font-medium mb-2">{result.type}</h3>
            {result.data ? (
              <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : (
              <p className="text-red-600">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}




















