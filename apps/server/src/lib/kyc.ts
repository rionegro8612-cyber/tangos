// apps/server/src/lib/kyc.ts
/**
 * KYC (Know Your Customer) 통합 시스템
 * PASS 1순위, NICE 전환 로직 포함
 */

import { kycClient } from './httpClient';
import { StandardError, createError } from './errorCodes';
import { StandardResponse } from './httpClient';

export interface KycRequest {
  name: string;
  birthDate: string; // YYYYMMDD
  phoneNumber: string;
  carrier?: string;
  ci?: string; // 연계정보
  di?: string; // 중복가입확인정보
}

export interface KycResponse {
  success: boolean;
  provider: 'PASS' | 'NICE';
  verified: boolean;
  data: {
    name: string;
    birthDate: string;
    age: number;
    phoneNumber: string;
    ci: string;
    di: string;
    carrier?: string;
  };
  failureReason?: string;
}

/**
 * 나이 계산
 */
function calculateAge(birthDate: string): number {
  const birth = new Date(
    parseInt(birthDate.substring(0, 4)),
    parseInt(birthDate.substring(4, 6)) - 1,
    parseInt(birthDate.substring(6, 8))
  );
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * PASS KYC 검증
 */
async function verifyWithPass(request: KycRequest): Promise<KycResponse> {
  const PASS_API_URL = process.env.PASS_API_URL || 'https://dev-api.sktelecom.com';
  const PASS_CLIENT_ID = process.env.PASS_CLIENT_ID;
  const PASS_CLIENT_SECRET = process.env.PASS_CLIENT_SECRET;

  if (!PASS_CLIENT_ID || !PASS_CLIENT_SECRET) {
    console.warn('[KYC] PASS credentials not configured, using STUB');
    return createStubResponse(request, 'PASS');
  }

  try {
    // PASS API 호출 (실제 구현 시)
    const response = await kycClient.post<any>(`${PASS_API_URL}/kyc/verify`, {
      clientId: PASS_CLIENT_ID,
      clientSecret: PASS_CLIENT_SECRET,
      name: request.name,
      birthDate: request.birthDate,
      phoneNumber: request.phoneNumber,
      carrier: request.carrier
    });

    if (!response.success) {
      throw createError.externalApiError('PASS KYC', response);
    }

    const age = calculateAge(request.birthDate);
    
    // 50세 미만 제한
    if (age < 50) {
      throw createError.kycAgeFailed(age);
    }

    return {
      success: true,
      provider: 'PASS',
      verified: true,
      data: {
        name: request.name,
        birthDate: request.birthDate,
        age,
        phoneNumber: request.phoneNumber,
        ci: response.data?.ci || 'mock_ci_from_pass',
        di: response.data?.di || 'mock_di_from_pass',
        carrier: request.carrier
      }
    };

  } catch (error) {
    if (error instanceof StandardError) {
      throw error;
    }

    throw createError.externalApiError('PASS KYC', error);
  }
}

/**
 * NICE KYC 검증
 */
async function verifyWithNice(request: KycRequest): Promise<KycResponse> {
  const NICE_API_URL = process.env.NICE_API_URL || 'https://svc.niceapi.co.kr';
  const NICE_CLIENT_ID = process.env.NICE_CLIENT_ID;
  const NICE_CLIENT_SECRET = process.env.NICE_CLIENT_SECRET;

  if (!NICE_CLIENT_ID || !NICE_CLIENT_SECRET) {
    console.warn('[KYC] NICE credentials not configured, using STUB');
    return createStubResponse(request, 'NICE');
  }

  try {
    // NICE API 호출 (실제 구현 시)
    const response = await kycClient.post<any>(`${NICE_API_URL}/digital/niceid/api/v1.0/common/crypto/token`, {
      dataHeader: {
        CNTY_CD: 'ko'
      },
      dataBody: {
        req_dtim: new Date().toISOString(),
        req_no: `REQ_${Date.now()}`,
        enc_data: {
          name: request.name,
          birth_date: request.birthDate,
          phone_no: request.phoneNumber
        }
      }
    }, {
      headers: {
        'client_id': NICE_CLIENT_ID,
        'client_secret': NICE_CLIENT_SECRET
      }
    });

    if (!response.success) {
      throw createError.externalApiError('NICE KYC', response);
    }

    const age = calculateAge(request.birthDate);
    
    // 50세 미만 제한
    if (age < 50) {
      throw createError.kycAgeFailed(age);
    }

    return {
      success: true,
      provider: 'NICE',
      verified: true,
      data: {
        name: request.name,
        birthDate: request.birthDate,
        age,
        phoneNumber: request.phoneNumber,
        ci: response.data?.ci || 'mock_ci_from_nice',
        di: response.data?.di || 'mock_di_from_nice',
        carrier: request.carrier
      }
    };

  } catch (error) {
    if (error instanceof StandardError) {
      throw error;
    }

    throw createError.externalApiError('NICE KYC', error);
  }
}

/**
 * STUB 응답 생성 (개발/테스트용)
 */
function createStubResponse(request: KycRequest, provider: 'PASS' | 'NICE'): KycResponse {
  const age = calculateAge(request.birthDate);
  
  // 개발환경에서는 특정 케이스 테스트 가능
  if (process.env.NODE_ENV === 'development') {
    // 테스트 케이스: 나이 제한
    if (request.name === '김영수' || age < 50) {
      throw createError.kycAgeFailed(age);
    }
    
    // 테스트 케이스: 정보 불일치
    if (request.name === '이불일치') {
      throw createError.kycMismatch('입력한 정보가 일치하지 않습니다');
    }
  }

  return {
    success: true,
    provider,
    verified: true,
    data: {
      name: request.name,
      birthDate: request.birthDate,
      age,
      phoneNumber: request.phoneNumber,
      ci: `stub_ci_${provider.toLowerCase()}_${Date.now()}`,
      di: `stub_di_${provider.toLowerCase()}_${Date.now()}`,
      carrier: request.carrier
    }
  };
}

/**
 * KYC 검증 메인 함수
 * PASS 1순위, 실패 시 NICE 전환
 */
export async function verifyKyc(request: KycRequest): Promise<KycResponse> {
  console.log(`[KYC] Starting verification for ${request.name}`);
  
  try {
    // 1순위: PASS 시도
    const passResult = await verifyWithPass(request);
    console.log(`[KYC] PASS verification successful for ${request.name}`);
    return passResult;
    
  } catch (passError) {
    console.warn(`[KYC] PASS verification failed for ${request.name}:`, passError);
    
    // PASS에서 나이 제한이나 정보 불일치 등 비즈니스 에러인 경우 NICE로 전환하지 않음
    if (passError instanceof StandardError && 
        (passError.code === 'KYC_AGE_RESTRICTION' || passError.code === 'KYC_INFO_MISMATCH')) {
      throw passError;
    }
    
    try {
      // 2순위: NICE 시도
      console.log(`[KYC] Falling back to NICE for ${request.name}`);
      const niceResult = await verifyWithNice(request);
      console.log(`[KYC] NICE verification successful for ${request.name}`);
      return niceResult;
      
    } catch (niceError) {
      console.error(`[KYC] Both PASS and NICE verification failed for ${request.name}:`, niceError);
      
      // NICE에서도 실패한 경우 마지막 에러를 throw
      if (niceError instanceof StandardError) {
        throw niceError;
      }
      
      // 둘 다 실패한 경우 일반적인 KYC 실패 에러
      throw new StandardError('KYC_VERIFICATION_FAILED', 'KYC 검증에 실패했습니다');
    }
  }
}

/**
 * KYC 결과 검증
 */
export function validateKycResult(result: KycResponse, expectedName: string, expectedBirth: string): boolean {
  if (!result.success || !result.verified) {
    return false;
  }
  
  return result.data.name === expectedName && result.data.birthDate === expectedBirth;
}
