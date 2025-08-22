import { context, trace } from '@opentelemetry/api';
import { sanitizeObject, maskPhone, maskEmail, maskName } from './security';
import { 
  compressLog, 
  shouldSampleLog, 
  aggregateHourlyLogs, 
  aggregateDailyLogs,
  LogLifecycleStage 
} from './log-retention';

// ===== Audit 로그 타입 정의 =====

export interface AuditLogEntry {
  // 기본 식별 정보
  id: string;                    // 고유 ID (UUID)
  timestamp: string;             // ISO 8601 타임스탬프
  requestId: string;             // 요청 ID (추적용)
  traceId: string;               // OpenTelemetry trace ID
  spanId: string;                // OpenTelemetry span ID
  
  // 사용자 정보
  userId?: string;               // 사용자 ID (인증된 경우)
  userPhone?: string;            // 사용자 전화번호 (마스킹됨)
  userEmail?: string;            // 사용자 이메일 (마스킹됨)
  userIp: string;                // 사용자 IP 주소
  userAgent?: string;            // 사용자 에이전트
  
  // 감사 이벤트 정보
  eventType: AuditEventType;     // 감사 이벤트 타입
  eventCategory: AuditEventCategory; // 감사 이벤트 카테고리
  action: 'create' | 'read' | 'update' | 'delete' | 'consent' | 'withdraw' | 'accept'; // 수행된 액션
  
  // 리소스 정보
  resourceType: string;          // 리소스 타입 (user, consent, pii 등)
  resourceId?: string;           // 리소스 ID
  resourcePath?: string;         // API 경로
  
  // 변경 내용
  oldValue?: any;                // 변경 전 값 (민감정보 제거됨)
  newValue?: any;                // 변경 후 값 (민감정보 제거됨)
  changes?: AuditChange[];       // 구체적인 변경 사항
  
  // 메타데이터
  reason?: string;               // 변경 사유
  adminAction?: boolean;         // 관리자에 의한 변경 여부
  consentRequired?: boolean;     // 동의가 필요한 변경인지 여부
  
  // 보안 정보
  sessionId?: string;            // 세션 ID
  tokenType?: string;            // 토큰 타입 (access, refresh 등)
  
  // 감사 추적
  parentEventId?: string;        // 부모 이벤트 ID (연관 이벤트 추적)
  relatedEventIds?: string[];    // 관련 이벤트 ID들
  
  // 보존 정책
  retentionDays?: number;        // 보존 기간 (일) - 압축 시 optional
  legalBasis?: string;           // 법적 근거 (GDPR, 개인정보보호법 등)
  
  // 시스템 정보
  environment?: string;          // 환경 (development, staging, production) - 압축 시 optional
  version?: string;              // 애플리케이션 버전 - 압축 시 optional
  source?: string;               // 소스 (api, admin, system 등) - 압축 시 optional
  
  // 🆕 로그 보존 관리 정보
  lifecycleStage?: LogLifecycleStage;  // 현재 수명주기 단계
  compressed?: boolean;                // 압축 여부
  sampled?: boolean;                   // 샘플링 여부
  originalSize?: number;               // 원본 크기 (바이트)
  compressedSize?: number;             // 압축 후 크기 (바이트)
}

// 감사 이벤트 타입
export type AuditEventType = 
  // 계정 관련
  | 'USER_REGISTRATION' | 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_DELETION'
  | 'PASSWORD_CHANGE' | 'PASSWORD_RESET' | 'PROFILE_UPDATE'
  
  // 권한 관련  
  | 'ROLE_ASSIGNMENT' | 'ROLE_REMOVAL' | 'PERMISSION_GRANT' | 'PERMISSION_REVOKE'
  | 'ADMIN_ACCESS' | 'PRIVILEGE_ESCALATION'
  
  // 약관동의 관련
  | 'TERMS_ACCEPT' | 'TERMS_WITHDRAW' | 'TERMS_UPDATE' | 'PRIVACY_CONSENT'
  | 'MARKETING_CONSENT' | 'THIRD_PARTY_CONSENT'
  
  // 개인정보 관련
  | 'PII_VIEW' | 'PII_UPDATE' | 'PII_DELETE' | 'PII_EXPORT'
  | 'DATA_RETENTION' | 'DATA_ANONYMIZATION'
  
  // 보안 관련
  | 'SECURITY_ALERT' | 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_VIOLATION'
  | 'AUTHENTICATION_FAILURE' | 'AUTHORIZATION_FAILURE'
  
  // 시스템 관련
  | 'CONFIGURATION_CHANGE' | 'BACKUP_CREATED' | 'RESTORE_PERFORMED'
  | 'MAINTENANCE_MODE' | 'SYSTEM_UPDATE';

// 감사 이벤트 카테고리
export type AuditEventCategory = 
  | 'ACCOUNT_MANAGEMENT'      // 계정 관리
  | 'ACCESS_CONTROL'          // 접근 제어
  | 'CONSENT_MANAGEMENT'      // 동의 관리
  | 'PRIVACY_PROTECTION'      // 개인정보 보호
  | 'SECURITY_MONITORING'     // 보안 모니터링
  | 'SYSTEM_OPERATIONS'       // 시스템 운영
  | 'COMPLIANCE'              // 규정 준수
  | 'DATA_PROCESSING';        // 데이터 처리

// 변경 사항 상세 정보
export interface AuditChange {
  field: string;               // 변경된 필드명
  oldValue: any;               // 변경 전 값
  newValue: any;               // 변경 후 값
  changeType: 'added' | 'removed' | 'modified'; // 변경 타입
  sensitive: boolean;           // 민감정보 여부
}

// ===== Audit 로거 클래스 =====

export class AuditLogger {
  private static instance: AuditLogger;
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000; // 메모리 보호를 위한 최대 로그 수
  
  private constructor() {}
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  // ===== 계정 관련 감사 로그 =====
  
  /**
   * 사용자 등록 감사 로그
   */
  logUserRegistration(
    requestId: string,
    userData: any,
    userIp: string,
    userAgent?: string,
    adminAction = false
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userIp,
      userAgent,
      eventType: 'USER_REGISTRATION',
      eventCategory: 'ACCOUNT_MANAGEMENT',
      action: 'create',
      resourceType: 'user',
      resourceId: userData.id || userData.userId,
      resourcePath: '/auth/register',
      newValue: this.sanitizeUserData(userData),
      adminAction,
      consentRequired: true,
      retentionDays: 2555, // 7년 (개인정보보호법)
      legalBasis: '개인정보보호법 제15조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  /**
   * 사용자 로그인 감사 로그
   */
  logUserLogin(
    requestId: string,
    userId: string,
    userPhone: string,
    userIp: string,
    userAgent?: string,
    sessionId?: string,
    tokenType?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: maskPhone(userPhone),
      userIp,
      userAgent,
      eventType: 'USER_LOGIN',
      eventCategory: 'ACCESS_CONTROL',
      action: 'read',
      resourceType: 'user',
      resourceId: userId,
      resourcePath: '/auth/login',
      sessionId,
      tokenType,
      retentionDays: 1095, // 3년 (통신비밀보호법)
      legalBasis: '통신비밀보호법 제13조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  /**
   * 사용자 프로필 변경 감사 로그
   */
  logProfileUpdate(
    requestId: string,
    userId: string,
    userPhone: string,
    userIp: string,
    oldData: any,
    newData: any,
    changes: AuditChange[],
    reason?: string,
    adminAction = false
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: maskPhone(userPhone),
      userIp,
      eventType: 'PROFILE_UPDATE',
      eventCategory: 'ACCOUNT_MANAGEMENT',
      action: 'update',
      resourceType: 'user',
      resourceId: userId,
      resourcePath: '/user/profile',
      oldValue: this.sanitizeUserData(oldData),
      newValue: this.sanitizeUserData(newData),
      changes: changes.map(change => ({
        ...change,
        oldValue: change.sensitive ? '[REDACTED]' : change.oldValue,
        newValue: change.sensitive ? '[REDACTED]' : change.newValue
      })),
      reason,
      adminAction,
      consentRequired: true,
      retentionDays: 2555,
      legalBasis: '개인정보보호법 제15조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  // ===== 권한 관련 감사 로그 =====
  
  /**
   * 역할 할당 감사 로그
   */
  logRoleAssignment(
    requestId: string,
    adminUserId: string,
    targetUserId: string,
    role: string,
    userIp: string,
    reason?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId: adminUserId,
      userIp,
      eventType: 'ROLE_ASSIGNMENT',
      eventCategory: 'ACCESS_CONTROL',
      action: 'update',
      resourceType: 'user_role',
      resourceId: targetUserId,
      resourcePath: '/admin/users/roles',
      oldValue: { userId: targetUserId, roles: [] },
      newValue: { userId: targetUserId, roles: [role] },
      changes: [{
        field: 'roles',
        oldValue: [],
        newValue: [role],
        changeType: 'added',
        sensitive: false
      }],
      reason,
      adminAction: true,
      retentionDays: 2555,
      legalBasis: '개인정보보호법 제15조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'admin'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  // ===== 약관동의 관련 감사 로그 =====
  
  /**
   * 약관 동의 감사 로그
   */
  logTermsConsent(
    requestId: string,
    userId: string,
    userPhone: string,
    userIp: string,
    termsType: string,
    version: string,
    action: 'accept' | 'withdraw',
    userAgent?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: maskPhone(userPhone),
      userIp,
      userAgent,
      eventType: action === 'accept' ? 'TERMS_ACCEPT' : 'TERMS_WITHDRAW',
      eventCategory: 'CONSENT_MANAGEMENT',
      action,
      resourceType: 'terms_consent',
      resourceId: `${userId}_${termsType}_${version}`,
      resourcePath: `/consent/${termsType}`,
      newValue: {
        termsType,
        version,
        action,
        timestamp: new Date().toISOString()
      },
      consentRequired: false, // 이미 동의한 내용
      retentionDays: 2555,
      legalBasis: '개인정보보호법 제15조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  // ===== 개인정보 관련 감사 로그 =====
  
  /**
   * 개인정보 열람 감사 로그
   */
  logPiiView(
    requestId: string,
    userId: string,
    userPhone: string,
    userIp: string,
    dataType: string,
    dataId: string,
    reason: 'user_request' | 'admin_review' | 'legal_requirement',
    userAgent?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: maskPhone(userPhone),
      userIp,
      userAgent,
      eventType: 'PII_VIEW',
      eventCategory: 'PRIVACY_PROTECTION',
      action: 'read',
      resourceType: 'pii_data',
      resourceId: dataId,
      resourcePath: `/user/data/${dataType}`,
      reason: `개인정보 열람: ${reason}`,
      adminAction: reason === 'admin_review',
      retentionDays: 1095,
      legalBasis: '개인정보보호법 제38조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  /**
   * 개인정보 삭제 요청 감사 로그
   */
  logPiiDeletionRequest(
    requestId: string,
    userId: string,
    userPhone: string,
    userIp: string,
    dataType: string,
    reason: 'user_request' | 'legal_requirement' | 'retention_expired' | 'data_breach',
    legalBasis?: string,
    userAgent?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: maskPhone(userPhone),
      userIp,
      userAgent,
      eventType: 'PII_DELETE',
      eventCategory: 'PRIVACY_PROTECTION',
      action: 'delete',
      resourceType: 'pii_data',
      resourceId: userId,
      resourcePath: `/user/data/${dataType}`,
      reason: `개인정보 삭제 요청: ${reason}`,
      adminAction: false,
      retentionDays: 2555, // 삭제 요청은 더 오래 보존
      legalBasis: legalBasis || '개인정보보호법 제17조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'api'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  // ===== 보안 관련 감사 로그 =====
  
  /**
   * 보안 경고 감사 로그
   */
  logSecurityAlert(
    requestId: string,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    userIp: string,
    userId?: string,
    userPhone?: string,
    userAgent?: string
  ): string {
    const eventId = this.generateEventId();
    
    const logEntry: AuditLogEntry = {
      id: eventId,
      timestamp: new Date().toISOString(),
      requestId,
      ...this.getTraceInfo(),
      userId,
      userPhone: userPhone ? maskPhone(userPhone) : undefined,
      userIp,
      userAgent,
      eventType: 'SECURITY_ALERT',
      eventCategory: 'SECURITY_MONITORING',
      action: 'create',
      resourceType: 'security_alert',
      resourceId: alertType,
      resourcePath: '/security/alerts',
      newValue: {
        alertType,
        severity,
        description,
        timestamp: new Date().toISOString()
      },
      retentionDays: 2555,
      legalBasis: '개인정보보호법 제29조',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      source: 'system'
    };
    
    this.addLog(logEntry);
    return eventId;
  }
  
  // ===== 헬퍼 함수들 =====
  
  /**
   * OpenTelemetry trace 정보 추출
   */
  private getTraceInfo() {
    try {
      const activeContext = context.active();
      const span = trace.getSpan(activeContext);
      
      if (span) {
        const spanContext = span.spanContext();
        return {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId
        };
      }
    } catch (e) {
      // OpenTelemetry가 비활성화된 경우 무시
    }
    
    return {
      traceId: 'unknown',
      spanId: 'unknown'
    };
  }
  
  /**
   * 사용자 데이터 민감정보 제거
   */
  private sanitizeUserData(data: any): any {
    if (!data) return data;
    
    const sanitized = { ...data };
    
    // 민감정보 필드들 마스킹
    if (sanitized.phone) sanitized.phone = maskPhone(sanitized.phone);
    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    if (sanitized.name) sanitized.name = maskName(sanitized.name);
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    
    return sanitized;
  }
  
  /**
   * 고유 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 로그 추가 (메모리 보호 + 보존 정책 적용)
   */
  private addLog(logEntry: AuditLogEntry): void {
    // 🆕 로그 보존 정책 적용
    const enhancedLogEntry = this.applyRetentionPolicy(logEntry);
    
    // 샘플링 적용
    if (!enhancedLogEntry.sampled) {
      return; // 샘플링된 로그는 저장하지 않음
    }
    
    this.logs.push(enhancedLogEntry);
    
    // 메모리 보호를 위한 로그 수 제한
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // 콘솔에 감사 로그 출력 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', {
        id: enhancedLogEntry.id,
        eventType: enhancedLogEntry.eventType,
        action: enhancedLogEntry.action,
        userId: enhancedLogEntry.userId,
        resourceType: enhancedLogEntry.resourceType,
        timestamp: enhancedLogEntry.timestamp,
        lifecycleStage: enhancedLogEntry.lifecycleStage,
        compressed: enhancedLogEntry.compressed,
        sampled: enhancedLogEntry.sampled
      });
    }
  }
  
  /**
   * 로그 보존 정책 적용
   */
  private applyRetentionPolicy(logEntry: AuditLogEntry): AuditLogEntry {
    // 원본 크기 계산
    const originalSize = JSON.stringify(logEntry).length;
    
    // 수명주기 단계 결정
    const lifecycleStage = this.getLogLifecycleStage(logEntry);
    
    // 샘플링 적용
    const sampled = shouldSampleLog(logEntry);
    
    // 압축 적용
    let compressedLog = logEntry;
    let compressed = false;
    let compressedSize = originalSize;
    
    if (lifecycleStage !== 'hot') {
      compressedLog = compressLog(logEntry);
      compressed = true;
      compressedSize = JSON.stringify(compressedLog).length;
    }
    
    // 보존 정책 정보 추가
    return {
      ...compressedLog,
      lifecycleStage,
      compressed,
      sampled,
      originalSize,
      compressedSize
    };
  }
  
  /**
   * 로그 수명주기 단계 결정
   */
  private getLogLifecycleStage(logEntry: AuditLogEntry): LogLifecycleStage {
    const logAge = this.getLogAge(logEntry.timestamp);
    
    if (logAge <= 7) {
      return 'hot';
    } else if (logAge <= 30) {
      return 'warm';
    } else if (logAge <= 90) {
      return 'cold';
    } else {
      return 'archived';
    }
  }
  
  /**
   * 로그 나이 계산 (일 단위)
   */
  private getLogAge(timestamp: string): number {
    const logDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - logDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // ===== 공개 메서드들 =====
  
  /**
   * 모든 감사 로그 조회
   */
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }
  
  /**
   * 사용자별 감사 로그 조회
   */
  getLogsByUser(userId: string): AuditLogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }
  
  /**
   * 이벤트 타입별 감사 로그 조회
   */
  getLogsByEventType(eventType: AuditEventType): AuditLogEntry[] {
    return this.logs.filter(log => log.eventType === eventType);
  }
  
  /**
   * 기간별 감사 로그 조회
   */
  getLogsByDateRange(startDate: Date, endDate: Date): AuditLogEntry[] {
    return this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }
  
  /**
   * 감사 로그 상태 확인
   */
  getStatus() {
    return {
      totalLogs: this.logs.length,
      maxLogs: this.maxLogs,
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version
    };
  }
  
  /**
   * 로그 초기화 (테스트용)
   */
  clearLogs(): void {
    this.logs = [];
  }
  
  // 🆕 로그 집계 기능 추가
  
  /**
   * 시간별 로그 집계
   */
  getHourlyAggregations(): any[] {
    return aggregateHourlyLogs(this.logs);
  }
  
  /**
   * 일별 로그 집계
   */
  getDailyAggregations(): any[] {
    return aggregateDailyLogs(this.logs);
  }
  
  /**
   * 수명주기별 로그 통계
   */
  getLifecycleStats(): {
    hot: { count: number; size: number; avgSize: number };
    warm: { count: number; size: number; avgSize: number };
    cold: { count: number; size: number; avgSize: number };
    archived: { count: number; size: number; avgSize: number };
  } {
    const stats = {
      hot: { count: 0, size: 0, avgSize: 0 },
      warm: { count: 0, size: 0, avgSize: 0 },
      cold: { count: 0, size: 0, avgSize: 0 },
      archived: { count: 0, size: 0, avgSize: 0 }
    };
    
    this.logs.forEach(log => {
      const stage = log.lifecycleStage || 'hot';
      const size = log.compressedSize || log.originalSize || 0;
      
      // 안전한 인덱싱을 위해 'deleted' 단계 제외
      if (stage !== 'deleted' && stats[stage as keyof typeof stats]) {
        const stat = stats[stage as keyof typeof stats];
        stat.count++;
        stat.size += size;
      }
    });
    
    // 평균 크기 계산
    Object.values(stats).forEach(stat => {
      stat.avgSize = stat.count > 0 ? stat.size / stat.count : 0;
    });
    
    return stats;
  }
  
  /**
   * 압축 및 샘플링 통계
   */
  getCompressionStats(): {
    totalLogs: number;
    compressedLogs: number;
    sampledLogs: number;
    compressionRatio: number;
    sizeReduction: number;
    totalOriginalSize: number;
    totalCompressedSize: number;
  } {
    const totalLogs = this.logs.length;
    const compressedLogs = this.logs.filter(log => log.compressed).length;
    const sampledLogs = this.logs.filter(log => log.sampled).length;
    
    const totalOriginalSize = this.logs.reduce((sum, log) => sum + (log.originalSize || 0), 0);
    const totalCompressedSize = this.logs.reduce((sum, log) => sum + (log.compressedSize || 0), 0);
    
    const compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
    const sizeReduction = totalOriginalSize - totalCompressedSize;
    
    return {
      totalLogs,
      compressedLogs,
      sampledLogs,
      compressionRatio,
      sizeReduction,
      totalOriginalSize,
      totalCompressedSize
    };
  }
}

// ===== 싱글톤 인스턴스 내보내기 =====
export const auditLogger = AuditLogger.getInstance();

// ===== 편의 함수들 =====

/**
 * 사용자 등록 감사 로그 (간편 함수)
 */
export function logUserRegistration(
  requestId: string,
  userData: any,
  userIp: string,
  userAgent?: string,
  adminAction = false
): string {
  return auditLogger.logUserRegistration(requestId, userData, userIp, userAgent, adminAction);
}

/**
 * 사용자 로그인 감사 로그 (간편 함수)
 */
export function logUserLogin(
  requestId: string,
  userId: string,
  userPhone: string,
  userIp: string,
  userAgent?: string,
  sessionId?: string,
  tokenType?: string
): string {
  return auditLogger.logUserLogin(requestId, userId, userPhone, userIp, userAgent, sessionId, tokenType);
}

/**
 * 프로필 변경 감사 로그 (간편 함수)
 */
export function logProfileUpdate(
  requestId: string,
  userId: string,
  userPhone: string,
  userIp: string,
  oldData: any,
  newData: any,
  changes: AuditChange[],
  reason?: string,
  adminAction = false
): string {
  return auditLogger.logProfileUpdate(requestId, userId, userPhone, userIp, oldData, newData, changes, reason, adminAction);
}

/**
 * 약관 동의 감사 로그 (간편 함수)
 */
export function logTermsConsent(
  requestId: string,
  userId: string,
  userPhone: string,
  userIp: string,
  termsType: string,
  version: string,
  action: 'accept' | 'withdraw',
  userAgent?: string
): string {
  return auditLogger.logTermsConsent(requestId, userId, userPhone, userIp, termsType, version, action, userAgent);
}

/**
 * 개인정보 열람 감사 로그 (간편 함수)
 */
export function logPiiView(
  requestId: string,
  userId: string,
  userPhone: string,
  userIp: string,
  dataType: string,
  dataId: string,
  reason: 'user_request' | 'admin_review' | 'legal_requirement',
  userAgent?: string
): string {
  return auditLogger.logPiiView(requestId, userId, userPhone, userIp, dataType, dataId, reason, userAgent);
}

/**
 * 개인정보 삭제 요청 감사 로그 (간편 함수)
 */
export function logPiiDeletionRequest(
  requestId: string,
  userId: string,
  userPhone: string,
  userIp: string,
  dataType: string,
  reason: 'user_request' | 'legal_requirement' | 'retention_expired' | 'data_breach',
  legalBasis?: string,
  userAgent?: string
): string {
  return auditLogger.logPiiDeletionRequest(requestId, userId, userPhone, userIp, dataType, reason, legalBasis, userAgent);
}

/**
 * 보안 경고 감사 로그 (간편 함수)
 */
export function logSecurityAlert(
  requestId: string,
  alertType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string,
  userIp: string,
  userId?: string,
  userPhone?: string,
  userAgent?: string
): string {
  return auditLogger.logSecurityAlert(requestId, alertType, severity, description, userIp, userId, userPhone, userAgent);
}

// ===== 초기화 완료 로그 =====
console.log('[AUDIT] Audit logging system initialized:', auditLogger.getStatus());
