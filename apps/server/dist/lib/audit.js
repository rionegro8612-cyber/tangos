"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.AuditLogger = void 0;
exports.logUserRegistration = logUserRegistration;
exports.logUserLogin = logUserLogin;
exports.logProfileUpdate = logProfileUpdate;
exports.logTermsConsent = logTermsConsent;
exports.logPiiView = logPiiView;
exports.logPiiDeletionRequest = logPiiDeletionRequest;
exports.logSecurityAlert = logSecurityAlert;
const api_1 = require("@opentelemetry/api");
const security_1 = require("./security");
const log_retention_1 = require("./log-retention");
// ===== Audit 로거 클래스 =====
class AuditLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 10000; // 메모리 보호를 위한 최대 로그 수
    }
    static getInstance() {
        if (!AuditLogger.instance) {
            AuditLogger.instance = new AuditLogger();
        }
        return AuditLogger.instance;
    }
    // ===== 계정 관련 감사 로그 =====
    /**
     * 사용자 등록 감사 로그
     */
    logUserRegistration(requestId, userData, userIp, userAgent, adminAction = false) {
        const eventId = this.generateEventId();
        const logEntry = {
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
    logUserLogin(requestId, userId, userPhone, userIp, userAgent, sessionId, tokenType) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: (0, security_1.maskPhone)(userPhone),
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
    logProfileUpdate(requestId, userId, userPhone, userIp, oldData, newData, changes, reason, adminAction = false) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: (0, security_1.maskPhone)(userPhone),
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
    logRoleAssignment(requestId, adminUserId, targetUserId, role, userIp, reason) {
        const eventId = this.generateEventId();
        const logEntry = {
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
    logTermsConsent(requestId, userId, userPhone, userIp, termsType, version, action, userAgent) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: (0, security_1.maskPhone)(userPhone),
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
    logPiiView(requestId, userId, userPhone, userIp, dataType, dataId, reason, userAgent) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: (0, security_1.maskPhone)(userPhone),
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
    logPiiDeletionRequest(requestId, userId, userPhone, userIp, dataType, reason, legalBasis, userAgent) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: (0, security_1.maskPhone)(userPhone),
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
    logSecurityAlert(requestId, alertType, severity, description, userIp, userId, userPhone, userAgent) {
        const eventId = this.generateEventId();
        const logEntry = {
            id: eventId,
            timestamp: new Date().toISOString(),
            requestId,
            ...this.getTraceInfo(),
            userId,
            userPhone: userPhone ? (0, security_1.maskPhone)(userPhone) : undefined,
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
    getTraceInfo() {
        try {
            const activeContext = api_1.context.active();
            const span = api_1.trace.getSpan(activeContext);
            if (span) {
                const spanContext = span.spanContext();
                return {
                    traceId: spanContext.traceId,
                    spanId: spanContext.spanId
                };
            }
        }
        catch (e) {
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
    sanitizeUserData(data) {
        if (!data)
            return data;
        const sanitized = { ...data };
        // 민감정보 필드들 마스킹
        if (sanitized.phone)
            sanitized.phone = (0, security_1.maskPhone)(sanitized.phone);
        if (sanitized.email)
            sanitized.email = (0, security_1.maskEmail)(sanitized.email);
        if (sanitized.name)
            sanitized.name = (0, security_1.maskName)(sanitized.name);
        if (sanitized.password)
            sanitized.password = '[REDACTED]';
        if (sanitized.token)
            sanitized.token = '[REDACTED]';
        return sanitized;
    }
    /**
     * 고유 이벤트 ID 생성
     */
    generateEventId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 로그 추가 (메모리 보호 + 보존 정책 적용)
     */
    addLog(logEntry) {
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
    applyRetentionPolicy(logEntry) {
        // 원본 크기 계산
        const originalSize = JSON.stringify(logEntry).length;
        // 수명주기 단계 결정
        const lifecycleStage = this.getLogLifecycleStage(logEntry);
        // 샘플링 적용
        const sampled = (0, log_retention_1.shouldSampleLog)(logEntry);
        // 압축 적용
        let compressedLog = logEntry;
        let compressed = false;
        let compressedSize = originalSize;
        if (lifecycleStage !== 'hot') {
            compressedLog = (0, log_retention_1.compressLog)(logEntry);
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
    getLogLifecycleStage(logEntry) {
        const logAge = this.getLogAge(logEntry.timestamp);
        if (logAge <= 7) {
            return 'hot';
        }
        else if (logAge <= 30) {
            return 'warm';
        }
        else if (logAge <= 90) {
            return 'cold';
        }
        else {
            return 'archived';
        }
    }
    /**
     * 로그 나이 계산 (일 단위)
     */
    getLogAge(timestamp) {
        const logDate = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - logDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    // ===== 공개 메서드들 =====
    /**
     * 모든 감사 로그 조회
     */
    getAllLogs() {
        return [...this.logs];
    }
    /**
     * 사용자별 감사 로그 조회
     */
    getLogsByUser(userId) {
        return this.logs.filter(log => log.userId === userId);
    }
    /**
     * 이벤트 타입별 감사 로그 조회
     */
    getLogsByEventType(eventType) {
        return this.logs.filter(log => log.eventType === eventType);
    }
    /**
     * 기간별 감사 로그 조회
     */
    getLogsByDateRange(startDate, endDate) {
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
    clearLogs() {
        this.logs = [];
    }
    // 🆕 로그 집계 기능 추가
    /**
     * 시간별 로그 집계
     */
    getHourlyAggregations() {
        return (0, log_retention_1.aggregateHourlyLogs)(this.logs);
    }
    /**
     * 일별 로그 집계
     */
    getDailyAggregations() {
        return (0, log_retention_1.aggregateDailyLogs)(this.logs);
    }
    /**
     * 수명주기별 로그 통계
     */
    getLifecycleStats() {
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
            if (stage !== 'deleted' && stats[stage]) {
                const stat = stats[stage];
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
    getCompressionStats() {
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
exports.AuditLogger = AuditLogger;
// ===== 싱글톤 인스턴스 내보내기 =====
exports.auditLogger = AuditLogger.getInstance();
// ===== 편의 함수들 =====
/**
 * 사용자 등록 감사 로그 (간편 함수)
 */
function logUserRegistration(requestId, userData, userIp, userAgent, adminAction = false) {
    return exports.auditLogger.logUserRegistration(requestId, userData, userIp, userAgent, adminAction);
}
/**
 * 사용자 로그인 감사 로그 (간편 함수)
 */
function logUserLogin(requestId, userId, userPhone, userIp, userAgent, sessionId, tokenType) {
    return exports.auditLogger.logUserLogin(requestId, userId, userPhone, userIp, userAgent, sessionId, tokenType);
}
/**
 * 프로필 변경 감사 로그 (간편 함수)
 */
function logProfileUpdate(requestId, userId, userPhone, userIp, oldData, newData, changes, reason, adminAction = false) {
    return exports.auditLogger.logProfileUpdate(requestId, userId, userPhone, userIp, oldData, newData, changes, reason, adminAction);
}
/**
 * 약관 동의 감사 로그 (간편 함수)
 */
function logTermsConsent(requestId, userId, userPhone, userIp, termsType, version, action, userAgent) {
    return exports.auditLogger.logTermsConsent(requestId, userId, userPhone, userIp, termsType, version, action, userAgent);
}
/**
 * 개인정보 열람 감사 로그 (간편 함수)
 */
function logPiiView(requestId, userId, userPhone, userIp, dataType, dataId, reason, userAgent) {
    return exports.auditLogger.logPiiView(requestId, userId, userPhone, userIp, dataType, dataId, reason, userAgent);
}
/**
 * 개인정보 삭제 요청 감사 로그 (간편 함수)
 */
function logPiiDeletionRequest(requestId, userId, userPhone, userIp, dataType, reason, legalBasis, userAgent) {
    return exports.auditLogger.logPiiDeletionRequest(requestId, userId, userPhone, userIp, dataType, reason, legalBasis, userAgent);
}
/**
 * 보안 경고 감사 로그 (간편 함수)
 */
function logSecurityAlert(requestId, alertType, severity, description, userIp, userId, userPhone, userAgent) {
    return exports.auditLogger.logSecurityAlert(requestId, alertType, severity, description, userIp, userId, userPhone, userAgent);
}
// ===== 초기화 완료 로그 =====
console.log('[AUDIT] Audit logging system initialized:', exports.auditLogger.getStatus());
