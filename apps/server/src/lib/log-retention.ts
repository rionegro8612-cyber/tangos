import { AuditLogEntry, AuditEventType } from "./audit";
import { sanitizeObject } from "./security";

// ===== 로그 보존 정책 타입 정의 =====

export interface RetentionPolicy {
  // 보존 기간 설정
  hot: {
    days: number; // 핫 로그 보존 기간
    compression: boolean; // 압축 여부
    replicas: number; // 복제본 수
    shards: number; // 샤드 수
  };
  warm: {
    days: number; // 웜 로그 보존 기간
    compression: boolean; // 압축 여부
    replicas: number; // 복제본 수
    shards: number; // 샤드 수
  };
  cold: {
    days: number; // 콜드 로그 보존 기간
    compression: boolean; // 압축 여부
    replicas: number; // 복제본 수
    shards: number; // 샤드 수
  };

  // 비용 최적화 설정
  costOptimization: {
    enableFieldSimplification: boolean; // 필드 단순화 활성화
    enableSampling: boolean; // 샘플링 활성화
    enableAggregation: boolean; // 집계 활성화
    maxFieldSize: number; // 최대 필드 크기 (바이트)
    maxFieldsPerLog: number; // 로그당 최대 필드 수
  };

  // 샘플링 정책
  sampling: {
    hot: number; // 핫 로그 샘플링 비율 (1.0 = 100%)
    warm: number; // 웜 로그 샘플링 비율
    cold: number; // 콜드 로그 샘플링 비율
    errorLogs: number; // 에러 로그 샘플링 비율 (항상 높게)
    securityLogs: number; // 보안 로그 샘플링 비율 (항상 높게)
  };

  // 집계 정책
  aggregation: {
    enableHourlyAggregation: boolean; // 시간별 집계
    enableDailyAggregation: boolean; // 일별 집계
    aggregationFields: string[]; // 집계할 필드들
    retentionDays: number; // 집계 로그 보존 기간
  };
}

// ===== 로그 수명주기 단계 =====
export type LogLifecycleStage = "hot" | "warm" | "cold" | "archived" | "deleted";

// ===== 단순화된 로그 필드 =====
export interface SimplifiedLogField {
  name: string; // 필드명
  type: "string" | "number" | "boolean" | "date" | "object";
  size: number; // 필드 크기 (바이트)
  required: boolean; // 필수 필드 여부
  sensitive: boolean; // 민감정보 여부
  retention: LogLifecycleStage[]; // 보존 단계
}

// ===== 로그 집계 결과 =====
export interface LogAggregation {
  id: string;
  timestamp: string;
  period: "hourly" | "daily";
  eventType: AuditEventType;
  count: number;
  errorCount: number;
  avgLatency?: number;
  uniqueUsers: number;
  uniqueIPs: number;
  topResources: Array<{ resource: string; count: number }>;
  topErrors: Array<{ error: string; count: number }>;
  metadata: {
    sourceLogs: number; // 집계된 원본 로그 수
    compressionRatio: number; // 압축 비율
    sizeReduction: number; // 크기 감소량 (바이트)
  };
}

// ===== 로그 보존 관리자 클래스 =====

export class LogRetentionManager {
  private static instance: LogRetentionManager;
  private retentionPolicy!: RetentionPolicy; // ! 연산자로 초기화 보장
  private simplifiedFields: Map<string, SimplifiedLogField> = new Map();
  private aggregations: Map<string, LogAggregation> = new Map();

  private constructor() {
    this.initializeRetentionPolicy();
    this.initializeSimplifiedFields();
  }

  static getInstance(): LogRetentionManager {
    if (!LogRetentionManager.instance) {
      LogRetentionManager.instance = new LogRetentionManager();
    }
    return LogRetentionManager.instance;
  }

  // ===== 보존 정책 초기화 =====

  private initializeRetentionPolicy(): void {
    this.retentionPolicy = {
      hot: {
        days: 7,
        compression: false,
        replicas: 1,
        shards: 3,
      },
      warm: {
        days: 30,
        compression: true,
        replicas: 1,
        shards: 2,
      },
      cold: {
        days: 90,
        compression: true,
        replicas: 0,
        shards: 1,
      },
      costOptimization: {
        enableFieldSimplification: true,
        enableSampling: true,
        enableAggregation: true,
        maxFieldSize: 1024, // 1KB
        maxFieldsPerLog: 20,
      },
      sampling: {
        hot: 1.0, // 핫 로그 100% 보존
        warm: 0.5, // 웜 로그 50% 샘플링
        cold: 0.1, // 콜드 로그 10% 샘플링
        errorLogs: 1.0, // 에러 로그 100% 보존
        securityLogs: 1.0, // 보안 로그 100% 보존
      },
      aggregation: {
        enableHourlyAggregation: true,
        enableDailyAggregation: true,
        aggregationFields: ["eventType", "userId", "userIp", "resourceType", "action"],
        retentionDays: 365,
      },
    };
  }

  // ===== 단순화된 필드 초기화 =====

  private initializeSimplifiedFields(): void {
    // 핵심 식별 필드 (항상 보존)
    this.addSimplifiedField("id", "string", 36, true, false, ["hot", "warm", "cold"]);
    this.addSimplifiedField("timestamp", "date", 24, true, false, ["hot", "warm", "cold"]);
    this.addSimplifiedField("requestId", "string", 50, true, false, ["hot", "warm", "cold"]);
    this.addSimplifiedField("eventType", "string", 30, true, false, ["hot", "warm", "cold"]);
    this.addSimplifiedField("action", "string", 20, true, false, ["hot", "warm", "cold"]);

    // 사용자 식별 필드 (핫/웜에서만 보존)
    this.addSimplifiedField("userId", "string", 50, false, false, ["hot", "warm"]);
    this.addSimplifiedField("userPhone", "string", 20, false, true, ["hot", "warm"]);
    this.addSimplifiedField("userIp", "string", 45, true, false, ["hot", "warm", "cold"]);

    // 리소스 정보 (핫/웜에서만 보존)
    this.addSimplifiedField("resourceType", "string", 30, false, false, ["hot", "warm"]);
    this.addSimplifiedField("resourceId", "string", 100, false, false, ["hot", "warm"]);
    this.addSimplifiedField("resourcePath", "string", 200, false, false, ["hot"]);

    // 변경 내용 (핫에서만 보존)
    this.addSimplifiedField("oldValue", "object", 500, false, false, ["hot"]);
    this.addSimplifiedField("newValue", "object", 500, false, false, ["hot"]);
    this.addSimplifiedField("changes", "object", 1000, false, false, ["hot"]);

    // 메타데이터 (핫에서만 보존)
    this.addSimplifiedField("reason", "string", 200, false, false, ["hot"]);
    this.addSimplifiedField("adminAction", "boolean", 1, false, false, ["hot"]);
    this.addSimplifiedField("consentRequired", "boolean", 1, false, false, ["hot"]);

    // 보안 정보 (핫/웜에서만 보존)
    this.addSimplifiedField("sessionId", "string", 100, false, false, ["hot", "warm"]);
    this.addSimplifiedField("tokenType", "string", 20, false, false, ["hot", "warm"]);

    // 감사 추적 (핫에서만 보존)
    this.addSimplifiedField("parentEventId", "string", 50, false, false, ["hot"]);
    this.addSimplifiedField("relatedEventIds", "object", 200, false, false, ["hot"]);

    // 보존 정책 (핫에서만 보존)
    this.addSimplifiedField("retentionDays", "number", 4, false, false, ["hot"]);
    this.addSimplifiedField("legalBasis", "string", 100, false, false, ["hot"]);

    // 시스템 정보 (핫에서만 보존)
    this.addSimplifiedField("environment", "string", 20, false, false, ["hot"]);
    this.addSimplifiedField("version", "string", 20, false, false, ["hot"]);
    this.addSimplifiedField("source", "string", 20, false, false, ["hot"]);
  }

  private addSimplifiedField(
    name: string,
    type: SimplifiedLogField["type"],
    size: number,
    required: boolean,
    sensitive: boolean,
    retention: LogLifecycleStage[],
  ): void {
    this.simplifiedFields.set(name, {
      name,
      type,
      size,
      required,
      sensitive,
      retention,
    });
  }

  // ===== 로그 수명주기 관리 =====

  /**
   * 로그의 현재 수명주기 단계 결정
   */
  getLogLifecycleStage(log: AuditLogEntry): LogLifecycleStage {
    const logAge = this.getLogAge(log.timestamp);

    if (logAge <= this.retentionPolicy.hot.days) {
      return "hot";
    } else if (logAge <= this.retentionPolicy.warm.days) {
      return "warm";
    } else if (logAge <= this.retentionPolicy.cold.days) {
      return "cold";
    } else {
      return "archived";
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

  /**
   * 로그 압축 적용
   */
  compressLog(log: AuditLogEntry): AuditLogEntry {
    const stage = this.getLogLifecycleStage(log);
    const policy = this.getStagePolicy(stage);

    if (!policy.compression) {
      return log;
    }

    // 압축된 로그 생성
    const compressedLog: AuditLogEntry = {
      ...log,
      // 대용량 필드 제거 또는 단순화
      oldValue: this.compressField(log.oldValue, stage),
      newValue: this.compressField(log.newValue, stage),
      changes: this.compressField(log.changes, stage),
      // 메타데이터 단순화
      reason: stage === "hot" ? log.reason : undefined,
      adminAction: stage === "hot" ? log.adminAction : undefined,
      consentRequired: stage === "hot" ? log.consentRequired : undefined,
      // 보안 정보 단순화
      sessionId: ["hot", "warm"].includes(stage) ? log.sessionId : undefined,
      tokenType: ["hot", "warm"].includes(stage) ? log.tokenType : undefined,
      // 감사 추적 단순화
      parentEventId: stage === "hot" ? log.parentEventId : undefined,
      relatedEventIds: stage === "hot" ? log.relatedEventIds : undefined,
      // 보존 정책 단순화
      retentionDays: stage === "hot" ? log.retentionDays : undefined,
      legalBasis: stage === "hot" ? log.legalBasis : undefined,
      // 시스템 정보 단순화
      environment: stage === "hot" ? log.environment : undefined,
      version: stage === "hot" ? log.version : undefined,
      source: stage === "hot" ? log.source : undefined,
    };

    return compressedLog;
  }

  /**
   * 필드 압축
   */
  private compressField(value: any, stage: LogLifecycleStage): any {
    if (!value) return value;

    if (typeof value === "string") {
      // 문자열 길이 제한
      const maxLength = stage === "hot" ? 500 : stage === "warm" ? 200 : 100;
      return value.length > maxLength ? value.substring(0, maxLength) + "..." : value;
    }

    if (typeof value === "object") {
      // 객체 단순화
      if (stage === "hot") return value;
      if (stage === "warm") return { summary: "Object data (compressed)" };
      return undefined;
    }

    return value;
  }

  /**
   * 단계별 정책 가져오기
   */
  private getStagePolicy(stage: LogLifecycleStage) {
    switch (stage) {
      case "hot":
        return this.retentionPolicy.hot;
      case "warm":
        return this.retentionPolicy.warm;
      case "cold":
        return this.retentionPolicy.cold;
      default:
        return this.retentionPolicy.cold;
    }
  }

  // ===== 로그 샘플링 =====

  /**
   * 로그 샘플링 적용
   */
  shouldSampleLog(log: AuditLogEntry): boolean {
    const stage = this.getLogLifecycleStage(log);
    const samplingRate = this.getSamplingRate(log, stage);

    // 에러 로그와 보안 로그는 항상 보존
    if (this.isErrorLog(log) || this.isSecurityLog(log)) {
      return true;
    }

    // 샘플링 적용
    return Math.random() < samplingRate;
  }

  /**
   * 샘플링 비율 결정
   */
  private getSamplingRate(log: AuditLogEntry, stage: LogLifecycleStage): number {
    switch (stage) {
      case "hot":
        return this.retentionPolicy.sampling.hot;
      case "warm":
        return this.retentionPolicy.sampling.warm;
      case "cold":
        return this.retentionPolicy.sampling.cold;
      default:
        return 0.1;
    }
  }

  /**
   * 에러 로그 여부 확인
   */
  private isErrorLog(log: AuditLogEntry): boolean {
    return (
      log.eventType.includes("FAILURE") ||
      log.eventType.includes("ERROR") ||
      log.eventType.includes("ALERT")
    );
  }

  /**
   * 보안 로그 여부 확인
   */
  private isSecurityLog(log: AuditLogEntry): boolean {
    return (
      log.eventCategory === "SECURITY_MONITORING" ||
      log.eventCategory === "ACCESS_CONTROL" ||
      log.eventType.includes("SECURITY") ||
      log.eventType.includes("AUTH")
    );
  }

  // ===== 로그 집계 =====

  /**
   * 시간별 로그 집계
   */
  aggregateHourlyLogs(logs: AuditLogEntry[]): LogAggregation[] {
    if (!this.retentionPolicy.aggregation.enableHourlyAggregation) {
      return [];
    }

    const hourlyGroups = new Map<string, AuditLogEntry[]>();

    // 시간별로 로그 그룹화
    logs.forEach((log) => {
      const hourKey = this.getHourKey(log.timestamp);
      if (!hourlyGroups.has(hourKey)) {
        hourlyGroups.set(hourKey, []);
      }
      hourlyGroups.get(hourKey)!.push(log);
    });

    // 각 시간별로 집계 생성
    const aggregations: LogAggregation[] = [];
    hourlyGroups.forEach((groupLogs, hourKey) => {
      const aggregation = this.createAggregation(groupLogs, "hourly", hourKey);
      aggregations.push(aggregation);
    });

    return aggregations;
  }

  /**
   * 일별 로그 집계
   */
  aggregateDailyLogs(logs: AuditLogEntry[]): LogAggregation[] {
    if (!this.retentionPolicy.aggregation.enableDailyAggregation) {
      return [];
    }

    const dailyGroups = new Map<string, AuditLogEntry[]>();

    // 일별로 로그 그룹화
    logs.forEach((log) => {
      const dayKey = this.getDayKey(log.timestamp);
      if (!dailyGroups.has(dayKey)) {
        dailyGroups.set(dayKey, []);
      }
      dailyGroups.get(dayKey)!.push(log);
    });

    // 각 일별로 집계 생성
    const aggregations: LogAggregation[] = [];
    dailyGroups.forEach((groupLogs, dayKey) => {
      const aggregation = this.createAggregation(groupLogs, "daily", dayKey);
      aggregations.push(aggregation);
    });

    return aggregations;
  }

  /**
   * 집계 생성
   */
  private createAggregation(
    logs: AuditLogEntry[],
    period: "hourly" | "daily",
    timeKey: string,
  ): LogAggregation {
    const eventTypeCounts = new Map<AuditEventType, number>();
    const errorCounts = new Map<string, number>();
    const resourceCounts = new Map<string, number>();
    const userIds = new Set<string>();
    const ips = new Set<string>();

    let totalLatency = 0;
    let latencyCount = 0;

    // 로그 분석
    logs.forEach((log) => {
      // 이벤트 타입별 카운트
      eventTypeCounts.set(log.eventType, (eventTypeCounts.get(log.eventType) || 0) + 1);

      // 에러 카운트
      if (this.isErrorLog(log)) {
        const errorKey = log.eventType;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      }

      // 리소스별 카운트
      if (log.resourceType) {
        resourceCounts.set(log.resourceType, (resourceCounts.get(log.resourceType) || 0) + 1);
      }

      // 고유 사용자 및 IP
      if (log.userId) userIds.add(log.userId);
      if (log.userIp) ips.add(log.userIp);
    });

    // 상위 리소스 및 에러
    const topResources = Array.from(resourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([resource, count]) => ({ resource, count }));

    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    // 압축 비율 계산
    const originalSize = this.calculateLogsSize(logs);
    const compressedSize = this.calculateLogsSize(logs.map((log) => this.compressLog(log)));
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    const aggregation: LogAggregation = {
      id: `agg_${period}_${timeKey}_${Date.now()}`,
      timestamp: timeKey,
      period,
      eventType: this.getMostFrequentEventType(eventTypeCounts) || "unknown",
      count: logs.length,
      errorCount: Array.from(errorCounts.values()).reduce((sum, count) => sum + count, 0),
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : undefined,
      uniqueUsers: userIds.size,
      uniqueIPs: ips.size,
      topResources: topResources || [],
      topErrors: topErrors || [],
      metadata: {
        sourceLogs: logs.length,
        compressionRatio: compressionRatio || 1,
        sizeReduction: 0, // sizeReduction 변수가 정의되지 않아 0으로 설정
      },
    };

    // 집계 저장
    this.aggregations.set(aggregation.id, aggregation);

    return aggregation;
  }

  /**
   * 시간 키 생성 (YYYY-MM-DD-HH)
   */
  private getHourKey(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().substring(0, 13).replace("T", "-");
  }

  /**
   * 일 키 생성 (YYYY-MM-DD)
   */
  private getDayKey(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().substring(0, 10);
  }

  /**
   * 가장 빈번한 이벤트 타입 찾기
   */
  private getMostFrequentEventType(eventTypeCounts: Map<AuditEventType, number>): AuditEventType {
    let maxCount = 0;
    let mostFrequent: AuditEventType = "USER_LOGIN";

    eventTypeCounts.forEach((count, eventType) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = eventType;
      }
    });

    return mostFrequent;
  }

  /**
   * 로그 크기 계산
   */
  private calculateLogsSize(logs: AuditLogEntry[]): number {
    return logs.reduce((total, log) => {
      return total + JSON.stringify(log).length;
    }, 0);
  }

  // ===== 비용 최적화 =====

  /**
   * 로그 비용 계산
   */
  calculateLogCost(logs: AuditLogEntry[]): {
    hotCost: number;
    warmCost: number;
    coldCost: number;
    totalCost: number;
    savings: number;
  } {
    const hotLogs = logs.filter((log) => this.getLogLifecycleStage(log) === "hot");
    const warmLogs = logs.filter((log) => this.getLogLifecycleStage(log) === "warm");
    const coldLogs = logs.filter((log) => this.getLogLifecycleStage(log) === "cold");

    // 단계별 비용 (GB당 월 비용)
    const hotCostPerGB = 100; // 고성능 SSD
    const warmCostPerGB = 30; // 중간 성능 HDD
    const coldCostPerGB = 5; // 저비용 아카이브

    const hotCost = this.calculateStageCost(hotLogs, hotCostPerGB);
    const warmCost = this.calculateStageCost(warmLogs, warmCostPerGB);
    const coldCost = this.calculateStageCost(coldLogs, coldCostPerGB);

    const totalCost = hotCost + warmCost + coldCost;

    // 압축 및 샘플링으로 인한 비용 절약
    const savings = this.calculateCostSavings(logs);

    return {
      hotCost,
      warmCost,
      coldCost,
      totalCost,
      savings,
    };
  }

  /**
   * 단계별 비용 계산
   */
  private calculateStageCost(logs: AuditLogEntry[], costPerGB: number): number {
    const totalSizeGB =
      logs.reduce((total, log) => {
        return total + JSON.stringify(log).length;
      }, 0) /
      (1024 * 1024 * 1024); // 바이트를 GB로 변환

    return totalSizeGB * costPerGB;
  }

  /**
   * 비용 절약 계산
   */
  private calculateCostSavings(logs: AuditLogEntry[]): number {
    const originalSize = this.calculateLogsSize(logs);
    const compressedSize = this.calculateLogsSize(logs.map((log) => this.compressLog(log)));

    // 압축으로 인한 절약
    const compressionSavings = (originalSize - compressedSize) / originalSize;

    // 샘플링으로 인한 절약
    const samplingSavings =
      1 -
      (this.retentionPolicy.sampling.hot * 0.3 +
        this.retentionPolicy.sampling.warm * 0.4 +
        this.retentionPolicy.sampling.cold * 0.3);

    return (compressionSavings + samplingSavings) * 100; // 백분율
  }

  // ===== 공개 메서드들 =====

  /**
   * 보존 정책 조회
   */
  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  /**
   * 보존 정책 업데이트
   */
  updateRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };

    console.log("[RETENTION] Retention policy updated:", this.retentionPolicy);
  }

  /**
   * 단순화된 필드 조회
   */
  getSimplifiedFields(): SimplifiedLogField[] {
    return Array.from(this.simplifiedFields.values());
  }

  /**
   * 집계 로그 조회
   */
  getAggregations(period?: "hourly" | "daily"): LogAggregation[] {
    if (period) {
      return Array.from(this.aggregations.values()).filter((agg) => agg.period === period);
    }
    return Array.from(this.aggregations.values());
  }

  /**
   * 로그 보존 상태 확인
   */
  getRetentionStatus(): {
    totalLogs: number;
    hotLogs: number;
    warmLogs: number;
    coldLogs: number;
    archivedLogs: number;
    totalSize: number;
    estimatedCost: number;
    savings: number;
  } {
    // 🚨 실제 구현에서는 데이터베이스에서 로그 수를 조회
    const mockLogs: AuditLogEntry[] = [];

    const hotLogs = mockLogs.filter((log) => this.getLogLifecycleStage(log) === "hot");
    const warmLogs = mockLogs.filter((log) => this.getLogLifecycleStage(log) === "warm");
    const coldLogs = mockLogs.filter((log) => this.getLogLifecycleStage(log) === "cold");
    const archivedLogs = mockLogs.filter((log) => this.getLogLifecycleStage(log) === "archived");

    const totalSize = this.calculateLogsSize(mockLogs);
    const costInfo = this.calculateLogCost(mockLogs);

    return {
      totalLogs: mockLogs.length,
      hotLogs: hotLogs.length,
      warmLogs: warmLogs.length,
      coldLogs: coldLogs.length,
      archivedLogs: archivedLogs.length,
      totalSize,
      estimatedCost: costInfo.totalCost,
      savings: costInfo.savings,
    };
  }

  /**
   * 데이터 초기화 (테스트용)
   */
  clearData(): void {
    this.aggregations.clear();
  }
}

// ===== 싱글톤 인스턴스 내보내기 =====
export const logRetentionManager = LogRetentionManager.getInstance();

// ===== 편의 함수들 =====

/**
 * 로그 압축 (간편 함수)
 */
export function compressLog(log: AuditLogEntry): AuditLogEntry {
  return logRetentionManager.compressLog(log);
}

/**
 * 로그 샘플링 확인 (간편 함수)
 */
export function shouldSampleLog(log: AuditLogEntry): boolean {
  return logRetentionManager.shouldSampleLog(log);
}

/**
 * 시간별 로그 집계 (간편 함수)
 */
export function aggregateHourlyLogs(logs: AuditLogEntry[]): LogAggregation[] {
  return logRetentionManager.aggregateHourlyLogs(logs);
}

/**
 * 일별 로그 집계 (간편 함수)
 */
export function aggregateDailyLogs(logs: AuditLogEntry[]): LogAggregation[] {
  return logRetentionManager.aggregateDailyLogs(logs);
}

/**
 * 로그 비용 계산 (간편 함수)
 */
export function calculateLogCost(logs: AuditLogEntry[]) {
  return logRetentionManager.calculateLogCost(logs);
}

// ===== 초기화 완료 로그 =====
console.log(
  "[RETENTION] Log retention management system initialized:",
  logRetentionManager.getRetentionStatus(),
);
