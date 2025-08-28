// apps/server/src/lib/health.ts
/**
 * 헬스체크 및 상태 모니터링 시스템
 */

import { pool } from "./db";
import { redis } from "./redis";

export interface HealthCheck {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  latency?: number;
  timestamp: number;
}

export interface SystemHealth {
  overall: "healthy" | "unhealthy" | "degraded";
  checks: HealthCheck[];
  uptime: number;
  timestamp: number;
}

/**
 * 에러율 추적을 위한 메트릭 저장소
 */
class ErrorRateTracker {
  private errorCounts = new Map<string, number>();
  private totalCounts = new Map<string, number>();
  private windowStart = Date.now();
  private readonly windowMs = 60000; // 1분 윈도우

  addRequest(endpoint: string, isError: boolean = false) {
    this.cleanOldData();

    const total = this.totalCounts.get(endpoint) || 0;
    this.totalCounts.set(endpoint, total + 1);

    if (isError) {
      const errors = this.errorCounts.get(endpoint) || 0;
      this.errorCounts.set(endpoint, errors + 1);
    }
  }

  getErrorRate(endpoint?: string): number {
    this.cleanOldData();

    if (endpoint) {
      const errors = this.errorCounts.get(endpoint) || 0;
      const total = this.totalCounts.get(endpoint) || 0;
      return total > 0 ? (errors / total) * 100 : 0;
    }

    // 전체 에러율
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalRequests = Array.from(this.totalCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  private cleanOldData() {
    const now = Date.now();
    if (now - this.windowStart > this.windowMs) {
      this.errorCounts.clear();
      this.totalCounts.clear();
      this.windowStart = now;
    }
  }
}

export const errorTracker = new ErrorRateTracker();

/**
 * 데이터베이스 헬스체크
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    const latency = Date.now() - start;

    return {
      name: "database",
      status: latency > 1000 ? "degraded" : "healthy",
      message: latency > 1000 ? "High latency detected" : "Connected",
      latency,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database connection failed",
      latency: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

/**
 * Redis 헬스체크
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - start;

    return {
      name: "redis",
      status: latency > 500 ? "degraded" : "healthy",
      message: latency > 500 ? "High latency detected" : "Connected",
      latency,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      name: "redis",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Redis connection failed",
      latency: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

/**
 * 에러율 헬스체크
 */
async function checkErrorRate(): Promise<HealthCheck> {
  const errorRate = errorTracker.getErrorRate();
  const threshold = 5; // 5% 임계치

  return {
    name: "error_rate",
    status:
      errorRate > threshold ? "unhealthy" : errorRate > threshold / 2 ? "degraded" : "healthy",
    message: `Error rate: ${errorRate.toFixed(2)}%`,
    timestamp: Date.now(),
  };
}

/**
 * 메모리 사용량 헬스체크
 */
async function checkMemory(): Promise<HealthCheck> {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;

  return {
    name: "memory",
    status: usagePercent > 90 ? "unhealthy" : usagePercent > 80 ? "degraded" : "healthy",
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    timestamp: Date.now(),
  };
}

/**
 * 전체 시스템 헬스체크
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const startTime = Date.now();

  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkErrorRate(),
    checkMemory(),
  ]);

  // 전체 상태 결정
  const hasUnhealthy = checks.some((check) => check.status === "unhealthy");
  const hasDegraded = checks.some((check) => check.status === "degraded");

  let overall: "healthy" | "unhealthy" | "degraded";
  if (hasUnhealthy) {
    overall = "unhealthy";
  } else if (hasDegraded) {
    overall = "degraded";
  } else {
    overall = "healthy";
  }

  return {
    overall,
    checks,
    uptime: process.uptime(),
    timestamp: startTime,
  };
}

/**
 * 간단한 liveness 체크 (서버가 응답하는지만 확인)
 */
export function isAlive(): boolean {
  return true;
}

/**
 * readiness 체크 (서비스 준비 상태 확인)
 * 데이터베이스와 Redis 연결이 필요
 */
export async function isReady(): Promise<boolean> {
  try {
    const [dbCheck, redisCheck] = await Promise.all([checkDatabase(), checkRedis()]);

    return dbCheck.status !== "unhealthy" && redisCheck.status !== "unhealthy";
  } catch {
    return false;
  }
}

/**
 * 자동 롤백 조건 체크
 */
export async function shouldRollback(): Promise<{ shouldRollback: boolean; reason?: string }> {
  const health = await getSystemHealth();

  // 에러율이 5% 이상이면 롤백
  const errorRateCheck = health.checks.find((check) => check.name === "error_rate");
  if (errorRateCheck?.status === "unhealthy") {
    return {
      shouldRollback: true,
      reason: `High error rate detected: ${errorRateCheck.message}`,
    };
  }

  // 데이터베이스가 unhealthy면 롤백
  const dbCheck = health.checks.find((check) => check.name === "database");
  if (dbCheck?.status === "unhealthy") {
    return {
      shouldRollback: true,
      reason: `Database unhealthy: ${dbCheck.message}`,
    };
  }

  // 메모리 사용량이 90% 이상이면 롤백
  const memoryCheck = health.checks.find((check) => check.name === "memory");
  if (memoryCheck?.status === "unhealthy") {
    return {
      shouldRollback: true,
      reason: `High memory usage: ${memoryCheck.message}`,
    };
  }

  return { shouldRollback: false };
}
