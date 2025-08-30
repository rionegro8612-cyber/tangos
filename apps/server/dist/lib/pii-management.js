"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.piiManager = exports.PiiManager = void 0;
exports.createPiiDeletionRequest = createPiiDeletionRequest;
exports.processPiiDeletionRequest = processPiiDeletionRequest;
exports.createPiiCorrectionRequest = createPiiCorrectionRequest;
const crypto_1 = __importDefault(require("crypto"));
const audit_1 = require("./audit");
// ===== PII 관리자 클래스 =====
class PiiManager {
    constructor() {
        this.deletionRequests = new Map();
        this.correctionRequests = new Map();
        this.dataLocations = new Map();
        this.initializeDataLocations();
    }
    static getInstance() {
        if (!PiiManager.instance) {
            PiiManager.instance = new PiiManager();
        }
        return PiiManager.instance;
    }
    // ===== 데이터 위치 초기화 =====
    initializeDataLocations() {
        // 사용자 계정 관련 데이터 위치
        this.addDataLocation("user_accounts", {
            table: "users",
            primaryKey: "id",
            identifierField: "phone",
            identifierValue: "",
            retentionPolicy: {
                type: "legal_requirement",
                retentionDays: 2555, // 7년
                legalBasis: "개인정보보호법 제15조",
                description: "사용자 계정 정보는 서비스 제공을 위해 필요",
            },
            accessCount: 0,
        });
        // OTP 관련 데이터 위치
        this.addDataLocation("otp_data", {
            table: "otp_codes",
            primaryKey: "id",
            identifierField: "phone",
            identifierValue: "",
            retentionPolicy: {
                type: "business_need",
                retentionDays: 30, // 30일
                legalBasis: "통신비밀보호법 제13조",
                description: "OTP 코드는 인증 완료 후 30일간 보존",
            },
            accessCount: 0,
        });
        // 인증 토큰 데이터 위치
        this.addDataLocation("auth_tokens", {
            table: "auth_tokens",
            primaryKey: "id",
            identifierField: "user_id",
            identifierValue: "",
            retentionPolicy: {
                type: "business_need",
                retentionDays: 365, // 1년
                legalBasis: "통신비밀보호법 제13조",
                description: "인증 토큰은 보안 감사 목적으로 1년간 보존",
            },
            accessCount: 0,
        });
        // 로그 데이터 위치
        this.addDataLocation("audit_logs", {
            table: "audit_logs",
            primaryKey: "id",
            identifierField: "user_id",
            identifierValue: "",
            retentionPolicy: {
                type: "legal_requirement",
                retentionDays: 2555, // 7년
                legalBasis: "개인정보보호법 제29조",
                description: "감사 로그는 법적 요구사항에 따라 7년간 보존",
            },
            accessCount: 0,
        });
        // 약관 동의 데이터 위치
        this.addDataLocation("consent_records", {
            table: "user_consents",
            primaryKey: "id",
            identifierField: "user_id",
            identifierValue: "",
            retentionPolicy: {
                type: "legal_requirement",
                retentionDays: 2555, // 7년
                legalBasis: "개인정보보호법 제15조",
                description: "동의 기록은 법적 분쟁 해결을 위해 7년간 보존",
            },
            accessCount: 0,
        });
        // 세션 데이터 위치
        this.addDataLocation("session_data", {
            table: "user_sessions",
            primaryKey: "id",
            identifierField: "user_id",
            identifierValue: "",
            retentionPolicy: {
                type: "business_need",
                retentionDays: 90, // 90일
                legalBasis: "통신비밀보호법 제13조",
                description: "세션 데이터는 보안 분석을 위해 90일간 보존",
            },
            accessCount: 0,
        });
    }
    addDataLocation(dataType, location) {
        if (!this.dataLocations.has(dataType)) {
            this.dataLocations.set(dataType, []);
        }
        this.dataLocations.get(dataType).push(location);
    }
    // ===== PII 삭제 요청 처리 =====
    /**
     * PII 삭제 요청 생성
     */
    createDeletionRequest(requestId, userPhone, userEmail, userId, userIp, dataTypes = [], reason = "user_request", priority = "normal") {
        const id = this.generateRequestId();
        // 감사 로그 기록
        const auditEventId = (0, audit_1.logPiiDeletionRequest)(requestId, userId || "anonymous", userPhone || "unknown", userIp, dataTypes.join(","), reason);
        const deletionRequest = {
            id,
            requestId,
            userId,
            userPhone,
            userEmail,
            userIp,
            requestType: "deletion",
            dataTypes: dataTypes.length > 0 ? dataTypes : this.getAllDataTypes(),
            reason,
            legalBasis: this.getLegalBasis(reason),
            status: "pending",
            priority,
            requestedAt: new Date(),
            successCount: 0,
            failureCount: 0,
            totalDataLocations: 0,
            auditEventId,
        };
        this.deletionRequests.set(id, deletionRequest);
        // 콘솔에 삭제 요청 로그 (개발 환경)
        if (process.env.NODE_ENV === "development") {
            console.log("[PII] Deletion request created:", {
                id,
                userPhone: userPhone ? this.maskPhone(userPhone) : "unknown",
                dataTypes: deletionRequest.dataTypes,
                reason,
                priority,
            });
        }
        return deletionRequest;
    }
    /**
     * PII 삭제 요청 처리
     */
    async processDeletionRequest(requestId) {
        const request = this.deletionRequests.get(requestId);
        if (!request) {
            throw new Error(`Deletion request not found: ${requestId}`);
        }
        if (request.status !== "pending") {
            throw new Error(`Request is not pending: ${request.status}`);
        }
        // 상태를 처리 중으로 변경
        request.status = "processing";
        request.processedBy = "system";
        const startTime = Date.now();
        let successCount = 0;
        let failureCount = 0;
        let totalLocations = 0;
        try {
            // 각 데이터 타입별로 삭제 처리
            for (const dataType of request.dataTypes) {
                const locations = this.dataLocations.get(dataType) || [];
                totalLocations += locations.length;
                for (const location of locations) {
                    try {
                        // 식별자 값 설정
                        location.identifierValue = this.getIdentifierValue(request, location.identifierField);
                        // 데이터 삭제 실행 (실제 구현에서는 데이터베이스 쿼리)
                        const success = await this.executeDataDeletion(location, request);
                        if (success) {
                            successCount++;
                        }
                        else {
                            failureCount++;
                        }
                    }
                    catch (error) {
                        console.error(`[PII] Error deleting data from ${location.table}:`, error);
                        failureCount++;
                    }
                }
            }
            // 요청 완료 처리
            request.status = "completed";
            request.processedAt = new Date();
            request.successCount = successCount;
            request.failureCount = failureCount;
            request.totalDataLocations = totalLocations;
            request.processingNotes = `Processed by system at ${new Date().toISOString()}`;
            const processingTime = Date.now() - startTime;
            // 성공 로그
            console.log(`[PII] Deletion request ${requestId} completed successfully:`, {
                successCount,
                failureCount,
                totalLocations,
                processingTime: `${processingTime}ms`,
            });
            return {
                success: true,
                message: "PII deletion completed successfully",
                details: {
                    successCount,
                    failureCount,
                    totalLocations,
                    processingTime,
                },
            };
        }
        catch (error) {
            // 실패 처리
            request.status = "failed";
            request.processedAt = new Date();
            request.processingNotes = `Failed: ${error instanceof Error ? error.message : "Unknown error"}`;
            console.error(`[PII] Deletion request ${requestId} failed:`, error);
            throw error;
        }
    }
    /**
     * 데이터 삭제 실행 (실제 구현에서는 데이터베이스 쿼리)
     */
    async executeDataDeletion(location, request) {
        try {
            // 🚨 실제 구현에서는 여기에 데이터베이스 삭제 쿼리를 실행
            // 예시: DELETE FROM ${location.table} WHERE ${location.identifierField} = ?
            // 시뮬레이션을 위한 지연
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            // 성공률 95%로 시뮬레이션
            const success = Math.random() > 0.05;
            if (success) {
                console.log(`[PII] Successfully deleted data from ${location.table} for ${location.identifierField}: ${this.maskIdentifier(location.identifierValue)}`);
            }
            else {
                console.log(`[PII] Failed to delete data from ${location.table} for ${location.identifierField}: ${this.maskIdentifier(location.identifierValue)}`);
            }
            return success;
        }
        catch (error) {
            console.error(`[PII] Error executing deletion for ${location.table}:`, error);
            return false;
        }
    }
    // ===== PII 수정 요청 처리 =====
    /**
     * PII 수정 요청 생성
     */
    createCorrectionRequest(requestId, userId, userPhone, userIp, fieldName, oldValue, newValue, reason) {
        const id = this.generateRequestId();
        const correctionRequest = {
            id,
            requestId,
            userId,
            userPhone,
            userIp,
            fieldName,
            oldValue,
            newValue,
            reason,
            status: "pending",
            requestedAt: new Date(),
        };
        this.correctionRequests.set(id, correctionRequest);
        console.log("[PII] Correction request created:", {
            id,
            userId,
            fieldName,
            reason,
        });
        return correctionRequest;
    }
    /**
     * PII 수정 요청 승인/거부
     */
    updateCorrectionRequestStatus(requestId, status, processedBy, rejectionReason) {
        const request = this.correctionRequests.get(requestId);
        if (!request) {
            throw new Error(`Correction request not found: ${requestId}`);
        }
        request.status = status;
        request.approvedBy = processedBy;
        request.approvedAt = new Date();
        if (status === "rejected" && rejectionReason) {
            request.rejectionReason = rejectionReason;
        }
        console.log(`[PII] Correction request ${requestId} ${status}:`, {
            processedBy,
            rejectionReason,
        });
        return request;
    }
    // ===== 헬퍼 함수들 =====
    /**
     * 식별자 값 추출
     */
    getIdentifierValue(request, fieldName) {
        switch (fieldName) {
            case "phone":
                return request.userPhone || "unknown";
            case "email":
                return request.userEmail || "unknown";
            case "user_id":
                return request.userId || "unknown";
            default:
                return "unknown";
        }
    }
    /**
     * 법적 근거 반환
     */
    getLegalBasis(reason) {
        switch (reason) {
            case "user_request":
                return "개인정보보호법 제17조 (개인정보의 삭제)";
            case "legal_requirement":
                return "개인정보보호법 제17조 (법적 요구사항)";
            case "retention_expired":
                return "개인정보보호법 제15조 (보존기간 만료)";
            case "data_breach":
                return "개인정보보호법 제34조 (개인정보 유출사고 대응)";
            default:
                return "개인정보보호법";
        }
    }
    /**
     * 모든 데이터 타입 반환
     */
    getAllDataTypes() {
        return Array.from(this.dataLocations.keys());
    }
    /**
     * 고유 요청 ID 생성
     */
    generateRequestId() {
        return `pii_${Date.now()}_${crypto_1.default.randomBytes(8).toString("hex")}`;
    }
    /**
     * 전화번호 마스킹
     */
    maskPhone(phone) {
        if (!phone || phone === "unknown")
            return "unknown";
        return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
    }
    /**
     * 식별자 마스킹
     */
    maskIdentifier(identifier) {
        if (!identifier || identifier === "unknown")
            return "unknown";
        if (identifier.includes("@")) {
            // 이메일 마스킹
            const [local, domain] = identifier.split("@");
            return `${local.charAt(0)}***@${domain.charAt(0)}***.com`;
        }
        else if (identifier.length > 4) {
            // 전화번호나 ID 마스킹
            return `${identifier.substring(0, 2)}***${identifier.substring(identifier.length - 2)}`;
        }
        return "***";
    }
    // ===== 공개 메서드들 =====
    /**
     * 삭제 요청 조회
     */
    getDeletionRequest(requestId) {
        return this.deletionRequests.get(requestId);
    }
    /**
     * 모든 삭제 요청 조회
     */
    getAllDeletionRequests() {
        return Array.from(this.deletionRequests.values());
    }
    /**
     * 사용자별 삭제 요청 조회
     */
    getDeletionRequestsByUser(userId) {
        return Array.from(this.deletionRequests.values()).filter((request) => request.userId === userId);
    }
    /**
     * 수정 요청 조회
     */
    getCorrectionRequest(requestId) {
        return this.correctionRequests.get(requestId);
    }
    /**
     * 모든 수정 요청 조회
     */
    getAllCorrectionRequests() {
        return Array.from(this.correctionRequests.values());
    }
    /**
     * 데이터 위치 정보 조회
     */
    getDataLocations(dataType) {
        if (dataType) {
            return this.dataLocations.get(dataType);
        }
        return this.dataLocations;
    }
    /**
     * PII 관리 상태 확인
     */
    getStatus() {
        return {
            deletionRequests: {
                total: this.deletionRequests.size,
                pending: Array.from(this.deletionRequests.values()).filter((r) => r.status === "pending")
                    .length,
                processing: Array.from(this.deletionRequests.values()).filter((r) => r.status === "processing").length,
                completed: Array.from(this.deletionRequests.values()).filter((r) => r.status === "completed").length,
                failed: Array.from(this.deletionRequests.values()).filter((r) => r.status === "failed")
                    .length,
            },
            correctionRequests: {
                total: this.correctionRequests.size,
                pending: Array.from(this.correctionRequests.values()).filter((r) => r.status === "pending")
                    .length,
                approved: Array.from(this.correctionRequests.values()).filter((r) => r.status === "approved").length,
                rejected: Array.from(this.correctionRequests.values()).filter((r) => r.status === "rejected").length,
            },
            dataTypes: Array.from(this.dataLocations.keys()),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version,
        };
    }
    /**
     * 데이터 초기화 (테스트용)
     */
    clearData() {
        this.deletionRequests.clear();
        this.correctionRequests.clear();
        this.dataLocations.clear();
        this.initializeDataLocations();
    }
}
exports.PiiManager = PiiManager;
// ===== 싱글톤 인스턴스 내보내기 =====
exports.piiManager = PiiManager.getInstance();
// ===== 편의 함수들 =====
/**
 * PII 삭제 요청 생성 (간편 함수)
 */
function createPiiDeletionRequest(requestId, userPhone, userEmail, userId, userIp, dataTypes, reason, priority) {
    return exports.piiManager.createDeletionRequest(requestId, userPhone, userEmail, userId, userIp, dataTypes || [], reason || "user_request", priority || "normal");
}
/**
 * PII 삭제 요청 처리 (간편 함수)
 */
function processPiiDeletionRequest(requestId) {
    return exports.piiManager.processDeletionRequest(requestId);
}
/**
 * PII 수정 요청 생성 (간편 함수)
 */
function createPiiCorrectionRequest(requestId, userId, userPhone, userIp, fieldName, oldValue, newValue, reason) {
    return exports.piiManager.createCorrectionRequest(requestId, userId, userPhone, userIp, fieldName, oldValue, newValue, reason);
}
// ===== 초기화 완료 로그 =====
console.log("[PII] PII management system initialized:", exports.piiManager.getStatus());
