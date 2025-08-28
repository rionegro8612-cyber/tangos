// apps/server/src/lib/secrets.ts
/**
 * 시크릿 관리 시스템
 * 환경별 분리, Secrets Manager 연동
 */

export interface SecretsConfig {
  // SMS 관련
  sms: {
    sens?: {
      accessKey: string;
      secretKey: string;
      serviceId: string;
    };
    nhn?: {
      accessKey: string;
      secretKey: string;
      serviceId: string;
    };
  };

  // KYC 관련
  kyc: {
    pass?: {
      apiUrl: string;
      clientId: string;
      clientSecret: string;
    };
    nice?: {
      apiUrl: string;
      clientId: string;
      clientSecret: string;
    };
  };

  // 소셜 로그인
  social: {
    kakao?: {
      restApiKey: string;
      clientSecret: string;
    };
    vworld?: {
      apiKey: string;
    };
  };
}

/**
 * 환경별 시크릿 로드
 */
export async function loadSecrets(): Promise<SecretsConfig> {
  const env = process.env.NODE_ENV || "development";

  if (env === "production") {
    return await loadProductionSecrets();
  } else if (env === "staging") {
    return await loadStagingSecrets();
  } else {
    return loadDevelopmentSecrets();
  }
}

/**
 * 개발환경 시크릿 (환경변수에서 로드)
 */
function loadDevelopmentSecrets(): SecretsConfig {
  return {
    sms: {
      sens: process.env.SENS_ACCESS_KEY
        ? {
            accessKey: process.env.SENS_ACCESS_KEY,
            secretKey: process.env.SENS_SECRET_KEY || "",
            serviceId: process.env.SENS_SERVICE_ID || "",
          }
        : undefined,
      nhn: process.env.NHN_ACCESS_KEY
        ? {
            accessKey: process.env.NHN_ACCESS_KEY,
            secretKey: process.env.NHN_SECRET_KEY || "",
            serviceId: process.env.NHN_SERVICE_ID || "",
          }
        : undefined,
    },
    kyc: {
      pass: process.env.PASS_CLIENT_ID
        ? {
            apiUrl: process.env.PASS_API_URL || "https://dev-api.sktelecom.com",
            clientId: process.env.PASS_CLIENT_ID,
            clientSecret: process.env.PASS_CLIENT_SECRET || "",
          }
        : undefined,
      nice: process.env.NICE_CLIENT_ID
        ? {
            apiUrl: process.env.NICE_API_URL || "https://svc.niceapi.co.kr",
            clientId: process.env.NICE_CLIENT_ID,
            clientSecret: process.env.NICE_CLIENT_SECRET || "",
          }
        : undefined,
    },
    social: {
      kakao: process.env.KAKAO_REST_API_KEY
        ? {
            restApiKey: process.env.KAKAO_REST_API_KEY,
            clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
          }
        : undefined,
      vworld: process.env.VWORLD_API_KEY
        ? {
            apiKey: process.env.VWORLD_API_KEY,
          }
        : undefined,
    },
  };
}

/**
 * 스테이징 환경 시크릿 (Secrets Manager에서 로드)
 */
async function loadStagingSecrets(): Promise<SecretsConfig> {
  try {
    // AWS Secrets Manager 연동 예시
    if (process.env.AWS_SECRETS_ENABLED === "true") {
      return await loadFromAwsSecretsManager("tango-staging");
    }

    // GCP Secret Manager 연동 예시
    if (process.env.GCP_SECRETS_ENABLED === "true") {
      return await loadFromGcpSecretManager("tango-staging");
    }

    // Azure Key Vault 연동 예시
    if (process.env.AZURE_SECRETS_ENABLED === "true") {
      return await loadFromAzureKeyVault("tango-staging");
    }

    // 기본값: 환경변수에서 로드 (스테이징용)
    return loadDevelopmentSecrets();
  } catch (error) {
    console.error("[SECRETS] Failed to load staging secrets:", error);
    // 에러 시 개발환경 시크릿으로 fallback
    return loadDevelopmentSecrets();
  }
}

/**
 * 프로덕션 환경 시크릿 (Secrets Manager에서만 로드)
 */
async function loadProductionSecrets(): Promise<SecretsConfig> {
  try {
    // AWS Secrets Manager 연동
    if (process.env.AWS_SECRETS_ENABLED === "true") {
      return await loadFromAwsSecretsManager("tango-production");
    }

    // GCP Secret Manager 연동
    if (process.env.GCP_SECRETS_ENABLED === "true") {
      return await loadFromGcpSecretManager("tango-production");
    }

    // Azure Key Vault 연동
    if (process.env.AZURE_SECRETS_ENABLED === "true") {
      return await loadFromAzureKeyVault("tango-production");
    }

    throw new Error("Production secrets must be loaded from Secrets Manager");
  } catch (error) {
    console.error("[SECRETS] Failed to load production secrets:", error);
    throw new Error("Critical: Cannot load production secrets");
  }
}

/**
 * AWS Secrets Manager에서 시크릿 로드
 */
async function loadFromAwsSecretsManager(secretName: string): Promise<SecretsConfig> {
  // TODO: AWS SDK 연동
  console.log(`[SECRETS] Loading from AWS Secrets Manager: ${secretName}`);

  // 임시 구현
  return {
    sms: {},
    kyc: {},
    social: {},
  };
}

/**
 * GCP Secret Manager에서 시크릿 로드
 */
async function loadFromGcpSecretManager(secretName: string): Promise<SecretsConfig> {
  // TODO: GCP SDK 연동
  console.log(`[SECRETS] Loading from GCP Secret Manager: ${secretName}`);

  // 임시 구현
  return {
    sms: {},
    kyc: {},
    social: {},
  };
}

/**
 * Azure Key Vault에서 시크릿 로드
 */
async function loadFromAzureKeyVault(secretName: string): Promise<SecretsConfig> {
  // TODO: Azure SDK 연동
  console.log(`[SECRETS] Loading from Azure Key Vault: ${secretName}`);

  // 임시 구현
  return {
    sms: {},
    kyc: {},
    social: {},
  };
}

/**
 * 시크릿 검증
 */
export function validateSecrets(secrets: SecretsConfig): string[] {
  const errors: string[] = [];

  // 필수 시크릿 검증
  if (!secrets.sms.sens && !secrets.sms.nhn) {
    errors.push("SMS 서비스 설정이 필요합니다 (SENS 또는 NHN)");
  }

  if (!secrets.kyc.pass && !secrets.kyc.nice) {
    errors.push("KYC 서비스 설정이 필요합니다 (PASS 또는 NICE)");
  }

  return errors;
}

/**
 * 시크릿 로드 및 검증
 */
export async function initializeSecrets(): Promise<SecretsConfig> {
  try {
    const secrets = await loadSecrets();
    const errors = validateSecrets(secrets);

    if (errors.length > 0) {
      console.warn("[SECRETS] Validation warnings:", errors);
    }

    console.log("[SECRETS] Secrets loaded successfully");
    return secrets;
  } catch (error) {
    console.error("[SECRETS] Failed to initialize secrets:", error);
    throw error;
  }
}

// 전역 시크릿 인스턴스
let globalSecrets: SecretsConfig | null = null;

/**
 * 전역 시크릿 가져오기
 */
export async function getSecrets(): Promise<SecretsConfig> {
  if (!globalSecrets) {
    globalSecrets = await initializeSecrets();
  }
  return globalSecrets;
}

/**
 * 시크릿 리로드 (핫 리로드용)
 */
export async function reloadSecrets(): Promise<void> {
  globalSecrets = null;
  await getSecrets();
}
